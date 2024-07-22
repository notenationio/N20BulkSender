import * as msgpack from '@msgpack/msgpack'
import { networks } from 'bitcoinjs-lib'
import BtcWalletConnect from 'n20-connect'
import { Mempool } from './mempool'

import type {
  IBroadcastResult,
  ICoinConfig,
  ISendToAddress,
  ISendToScript,
  ITokenUtxo,
  ITransaction,
  ITransferN20Data,
  IUtxo,
  IWalletAccount,
  NotePayload,
  ISendTarget,
} from './n20_types'

import {
  MAX_SCRIPT_ELEMENT_SIZE,
  MAX_SCRIPT_FULL_SIZE,
  MAX_STACK_FULL_SIZE,
  MAX_STANDARD_STACK_ITEM_SIZE,
  MIN_SATOSHIS,
  coins_config,
} from './n20_config'

import { splitBufferIntoSegments, toXOnly } from './n20_utils'
import { Urchain } from './urchain'
import { generateP2TRNoteAddress, generateP2WPHKAddress, createP2TRNotePsbt } from './btc-note'

class N20Wallet {
  config: ICoinConfig
  urchain!: Urchain
  currentAccount!: IWalletAccount
  btc_wallet!: BtcWalletConnect
  constructor(btc_wallet: BtcWalletConnect) {
    this.btc_wallet = btc_wallet
    this.config = coins_config.find((c) => btc_wallet.network.includes(c.network)) as ICoinConfig
    this.urchain = new Urchain(this.config.urchain.host, this.config.urchain.apiKey)
    if (this.btc_wallet.publicKey !== undefined) {
      this.currentAccount = this.createAccount(this.btc_wallet.publicKey)
    }
  }

  private createAccount(pubkey: string): IWalletAccount {
    const publicKeyBuffer = Buffer.from(pubkey, 'hex')

    const xOnlyPubkey = toXOnly(publicKeyBuffer)

    const network = networks[this.btc_wallet.network.includes('livenet') ? 'bitcoin' : 'testnet']
    const addressP2WPKH = generateP2WPHKAddress(Buffer.from(pubkey, 'hex'), network)

    const addressP2TRNote = generateP2TRNoteAddress(Buffer.from(pubkey, 'hex'), network)

    const account = {
      publicKey: publicKeyBuffer,
      xOnlyPubkey: xOnlyPubkey.toString('hex'),
      mainAddress: addressP2WPKH,
      tokenAddress: addressP2TRNote,
    }

    return account
  }
  async getTokenUtxos(tick: string, amount?: bigint) {
    const tokenUtxos = await this.urchain.tokenutxos(
      [this.currentAccount.tokenAddress!.scriptHash],
      tick,
      amount
    )
    if (tokenUtxos.length === 0) {
      throw new Error('No UTXOs found')
    }

    return tokenUtxos
  }

  async getBalance() {
    const p2wpkh = await this.urchain.balance(this.currentAccount.mainAddress!.scriptHash)
    const p2trnode = await this.urchain.balance(this.currentAccount.tokenAddress!.scriptHash)
    return {
      mainAddress: {
        confirmed: BigInt(p2wpkh.confirmed),
        unconfirmed: BigInt(p2wpkh.unconfirmed),
      },
      tokenAddress: {
        confirmed: BigInt(p2trnode.confirmed),
        unconfirmed: BigInt(p2trnode.unconfirmed),
      },
    }
  }

  async tokenList() {
    const results = await this.urchain.tokenList(this.currentAccount.tokenAddress!.scriptHash)
    return results
  }

  async fetchAllAccountUtxos(includeUnbondedTokenUtxos = false) {
    const allScriptHashs: string[] = []
    const allAccounts = new Map<string, IWalletAccount>()

    allScriptHashs.push(this.currentAccount.mainAddress!.scriptHash)
    allAccounts.set(this.currentAccount.mainAddress!.scriptHash, this.currentAccount)
    // In blockchain development, it's not uncommon for users to accidentally send small
    // amounts of Bitcoin (satoshis) to token addresses. To recover these funds, there's an
    // option that allows you to access the related Unspent Transaction Outputs (UTXOs). But
    // beware! Enabling this feature could lead to unintended spending of your tokens. Always
    // double-check before proceeding!
    if (includeUnbondedTokenUtxos) {
      allScriptHashs.push(this.currentAccount.tokenAddress!.scriptHash)
      allAccounts.set(this.currentAccount.tokenAddress!.scriptHash, this.currentAccount)
    }

    const allUtxos: IUtxo[] = await this.urchain.utxos(allScriptHashs)
    for (const utxo of allUtxos) {
      const account = allAccounts.get(utxo.scriptHash)
      if (account) {
        //        utxo.privateKeyWif = account.privateKey;
        if (utxo.scriptHash === account.mainAddress?.scriptHash) {
          utxo.type = account.mainAddress?.type
        }
        if (utxo.scriptHash === account.tokenAddress?.scriptHash) {
          utxo.type = account.tokenAddress?.type
        }
      }
    }
    return allUtxos
  }

  async broadcastTransaction(tx: ITransaction): Promise<IBroadcastResult> {
    return await this.urchain.broadcast(tx.txHex)
  }

  async tokenInfo(tick: string) {
    const result = await this.urchain.tokenInfo(tick)
    return result
  }

  async buildN20Transaction(
    payload: NotePayload,
    tokenAddresses: ISendToAddress[] | ISendToScript[],
    noteUtxos: IUtxo[],
    payUtxos?: IUtxo[],
    feeRate?: number
  ) {
    if (undefined === payUtxos) {
      payUtxos = await this.fetchAllAccountUtxos()
    }
    if (undefined === feeRate) {
      feeRate = (await this.getFeePerKb()).avgFee
    }
    const network = networks[this.btc_wallet.network.includes('livenet') ? 'bitcoin' : 'testnet']

    const finalTx = await createP2TRNotePsbt(
      this,
      payload,
      noteUtxos,
      payUtxos,
      tokenAddresses as ISendToAddress[],
      network,
      feeRate
    )

    return {
      noteUtxos,
      payUtxos,
      txId: finalTx.getId(),
      txHex: finalTx.toHex(),
      feeRate,
    }
  }

  private buildN20Payload(data: string | object, useScriptSize = false) {
    const encodedData = msgpack.encode(data, {
      sortKeys: true,
      useBigInt64: true,
    })
    const payload: NotePayload = {
      data0: '',
      data1: '',
      data2: '',
      data3: '',
      data4: '',
    }
    const buffer = Buffer.from(encodedData)

    let dataList
    if (buffer.length <= MAX_STACK_FULL_SIZE) {
      dataList = splitBufferIntoSegments(buffer, MAX_STANDARD_STACK_ITEM_SIZE)
    } else if (useScriptSize && buffer.length <= MAX_SCRIPT_FULL_SIZE) {
      dataList = splitBufferIntoSegments(buffer, MAX_SCRIPT_ELEMENT_SIZE)
    } else {
      throw new Error('data is too long')
    }
    if (dataList) {
      payload.data0 = dataList[0] !== undefined ? dataList[0].toString('hex') : ''
      payload.data1 = dataList[1] !== undefined ? dataList[1].toString('hex') : ''
      payload.data2 = dataList[2] !== undefined ? dataList[2].toString('hex') : ''
      payload.data3 = dataList[3] !== undefined ? dataList[3].toString('hex') : ''
      payload.data4 = dataList[4] !== undefined ? dataList[4].toString('hex') : ''
    } else {
      payload.data0 = buffer.toString('hex')
      payload.data1 = ''
      payload.data2 = ''
      payload.data3 = ''
      payload.data4 = ''
    }
    return payload
  }

  async sendTokenBatch(tick: string, targets: ISendTarget[]) {
    if (targets == undefined || targets.length < 1) {
      throw new Error('No address found')
    }

    let totalAmt = BigInt(0)
    for (let i = 0; i < targets.length; i++) {
      const curAmt = targets[i].amount
      if (curAmt !== undefined) {
        totalAmt += curAmt
      }
    }

    const tokenUtxos = await this.getTokenUtxos(tick, totalAmt)
    const balance = tokenUtxos.reduce(
      (acc: bigint, cur: ITokenUtxo) => acc + BigInt(cur.amount),
      BigInt(0)
    )
    if (balance < totalAmt) {
      throw new Error('Insufficient balance')
    }

    const amts: bigint[] = []
    const curAddress = targets[0].address
    amts.push(targets[0].amount)

    if (curAddress == undefined) {
      throw new Error('No address found')
    }
    const toAddresses: ISendToAddress[] = [{ address: curAddress, amount: MIN_SATOSHIS }]
    for (let i = 1; i < targets.length; i++) {
      const curAddress = targets[i].address
      amts.push(targets[i].amount)

      if (curAddress !== undefined) {
        toAddresses.push({
          address: curAddress,
          amount: MIN_SATOSHIS,
        })
      }
    }

    const missedTokenUtxos = await this.urchain.tokenutxos(
      [this.currentAccount.mainAddress!.scriptHash],
      tick
    )
    if (balance > BigInt(totalAmt) || missedTokenUtxos.length > 0) {
      toAddresses.push({
        address: this.currentAccount.tokenAddress!.address!,
        amount: MIN_SATOSHIS,
      })
    }
    const transferData: ITransferN20Data = {
      p: 'n20',
      op: 'transfer',
      tick,
      amt: amts,
    }

    const payUtxos: IUtxo[] = await this.fetchAllAccountUtxos()
    if (missedTokenUtxos.length > 0) {
      payUtxos.push(
        ...missedTokenUtxos.map((utxo: IUtxo) => {
          //            utxo.privateKeyWif = this.currentAccount.privateKey;
          utxo.type = this.currentAccount.mainAddress!.type
          return utxo
        })
      )
    }

    const payload = this.buildN20Payload(transferData)
    const tx = await this.buildN20Transaction(payload, toAddresses, tokenUtxos, payUtxos)

    const result = await this.broadcastTransaction(tx) // {txId:'111111', success: true}; //await this.broadcastTransaction(tx);

    return {
      transferData,
      result,
    }
  }

  async getFeePerKb() {
    let hostname =
      this.config.network === 'testnet' ? 'https://mempool.space/testnet4' : 'https://mempool.space'
    hostname += '/api/v1/'
    const memPool = new Mempool(hostname)
    const feesRecommended = await memPool.getFeePerKb()
    return {
      slowFee: Math.min(feesRecommended.hourFee, feesRecommended.halfHourFee) * 1000,
      avgFee: Math.max(feesRecommended.hourFee, feesRecommended.halfHourFee) * 1000,
      fastFee:
        Math.max(feesRecommended.hourFee, feesRecommended.halfHourFee, feesRecommended.fastestFee) *
        1000,
    }
  }
}

export default N20Wallet
