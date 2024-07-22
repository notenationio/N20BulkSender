import { script, payments, Psbt, Network, crypto } from 'bitcoinjs-lib'

interface Tapleaf {
  output: Buffer
  version?: number
}

type Taptree = [Taptree | Tapleaf, Taptree | Tapleaf] | Tapleaf

import { buildNoteScript, witnessStackToScriptWitness, toXOnly } from './n20_utils'

import type { AddressType, IAddressObject, ISendToAddress, IUtxo, NotePayload } from './n20_types'
import { MIN_SATOSHIS, MAX_SEQUENCE } from './n20_config'
import N20_Wallet from './n20_wallet'

export function generateP2TRNoteInfo(pubkey: Buffer, network: Network) {
  const xOnlyPubkey = toXOnly(pubkey)

  const note_script = script.fromASM(buildNoteScript(xOnlyPubkey))

  const p2pk_script_asm = `${xOnlyPubkey.toString('hex')} OP_CHECKSIG`
  const p2pk_script = script.fromASM(p2pk_script_asm)

  const scriptTree: Taptree = [
    {
      output: note_script,
    },
    {
      output: p2pk_script,
    },
  ]
  const script_p2tr = payments.p2tr({
    internalPubkey: xOnlyPubkey,
    scriptTree,
    network,
  })

  const note_redeem = {
    output: note_script,
    redeemVersion: 192,
  }
  const p2pk_redeem = {
    output: p2pk_script,
    redeemVersion: 192,
  }

  const p2pk_p2tr = payments.p2tr({
    internalPubkey: xOnlyPubkey,
    scriptTree,
    redeem: p2pk_redeem,
    network,
  })

  const note_p2tr = payments.p2tr({
    internalPubkey: xOnlyPubkey,
    scriptTree,
    redeem: note_redeem,
    network,
  })

  return {
    scriptP2TR: script_p2tr,
    noteP2TR: note_p2tr,
    p2pkP2TR: p2pk_p2tr,
    noteRedeem: note_redeem,
    p2pkRedeem: p2pk_redeem,
  }
}

export function generateP2WPHKAddress(pubkey: Buffer, network: Network) {
  const { address, output } = payments.p2wpkh({
    pubkey,
    network,
  })
  const script = output!.toString('hex')
  // with SHA256 hash
  const scriptHash = crypto.sha256(output!).reverse().toString('hex')
  const type: AddressType = 'P2WPKH'

  return {
    address: address!,
    script,
    scriptHash,
    type,
  }
}

export function generateP2TRNoteAddress(pubkey: Buffer, network: Network): IAddressObject {
  const { scriptP2TR } = generateP2TRNoteInfo(pubkey, network)

  const script = scriptP2TR.output!.toString('hex')
  // with SHA256 hash
  const scriptHash = crypto.sha256(scriptP2TR.output!).reverse().toString('hex')
  const type: AddressType = 'P2TR-NOTE'

  return {
    address: scriptP2TR.address!,
    script,
    scriptHash,
    type,
  }
}

export async function createP2TRNotePsbt(
  n20_wallet: N20_Wallet,
  notePayload: NotePayload,
  noteUtxos: IUtxo[],
  payUtxos: IUtxo[],
  toAddresses: ISendToAddress[],
  network: Network,
  feeRate: number
) {
  const p2note = generateP2TRNoteInfo(n20_wallet.currentAccount.publicKey, network)
  const tapLeafNoteScript = {
    leafVersion: p2note.noteRedeem.redeemVersion,
    script: p2note.noteRedeem.output,
    controlBlock: p2note.noteP2TR.witness![p2note.noteP2TR.witness!.length - 1]!,
  }
  const tapLeafP2PKScript = {
    leafVersion: p2note.p2pkRedeem.redeemVersion,
    script: p2note.p2pkRedeem.output,
    controlBlock: p2note.p2pkP2TR.witness![p2note.p2pkP2TR.witness!.length - 1]!,
  }

  const psbt = new Psbt({ network })
  psbt.setVersion(2)
  psbt.setLocktime(notePayload.locktime ?? 0) // to change tx
  let totalInput = 0
  {
    const noteUtxo = noteUtxos[0]!

    const input = {
      hash: noteUtxo.txId,
      index: noteUtxo.outputIndex,
      sequence: MAX_SEQUENCE,
      witnessUtxo: {
        script: p2note.noteP2TR.output!,
        value: noteUtxo.satoshis,
      },
      tapLeafScript: [tapLeafNoteScript],
    }
    psbt.addInput(input)
    totalInput += noteUtxo.satoshis
  }
  {
    for (let i = 1; i < noteUtxos.length; i++) {
      const noteUtxo = noteUtxos[i]!
      const input = {
        hash: noteUtxo.txId,
        index: noteUtxo.outputIndex,
        sequence: MAX_SEQUENCE,
        witnessUtxo: {
          script: p2note.p2pkP2TR.output!,
          value: noteUtxo.satoshis,
        },
        tapLeafScript: [tapLeafP2PKScript],
      }
      psbt.addInput(input)
      totalInput += noteUtxo.satoshis
    }
  }

  totalInput += addPsbtPayUtxos(n20_wallet.currentAccount.publicKey, psbt, payUtxos, network)

  let totalOutput = 0
  for (const to of toAddresses) {
    psbt.addOutput({
      address: to.address,
      value: Number(to.amount),
    })
    totalOutput += Number(to.amount)
  }

  const extSize =
    notePayload.data0.length +
    notePayload.data1.length +
    notePayload.data2.length +
    notePayload.data3.length +
    notePayload.data4.length

  const fastEstimatedSize =
    (psbt.txInputs.length * 51993) / 628 + ((psbt.txOutputs.length + 1) * 327) / 9 + extSize / 2 // TODO: check this formula, the result if little big than real size

  const realFee = Math.floor((fastEstimatedSize * feeRate) / 1000 + 1)

  const value = totalInput - totalOutput - realFee

  if (value < 0) throw new Error('NoFund')

  if (value > MIN_SATOSHIS) {
    psbt.addOutput({
      address: n20_wallet.currentAccount.mainAddress!.address!,
      value: value,
    })
  }

  const signOptions: {
    index: number
    publicKey: string
    disableTweakSigner: boolean
  }[] = []

  for (let i = 0; i < noteUtxos.length; i++) {
    signOptions.push({
      index: i,
      publicKey: n20_wallet.currentAccount.publicKey.toString('hex'),
      disableTweakSigner: true,
    })
  }
  for (let i = noteUtxos.length; i < psbt.inputCount; i++) {
    signOptions.push({
      index: i,
      publicKey: n20_wallet.currentAccount.publicKey.toString('hex'),
      disableTweakSigner: true,
    })
  }

  const new_psbt_hex = await n20_wallet.btc_wallet.signPsbt(psbt.toHex(), {
    toSignInputs: signOptions,
    autoFinalized: false,
  })

  const psbt_new = Psbt.fromHex(new_psbt_hex, { network })

  function getNoteFinalScripts(index: number, input: any) {
    const scriptSolution = [
      input.tapScriptSig[0].signature,
      Buffer.from(notePayload.data0, 'hex'),
      Buffer.from(notePayload.data1, 'hex'),
      Buffer.from(notePayload.data2, 'hex'),
      Buffer.from(notePayload.data3, 'hex'),
      Buffer.from(notePayload.data4, 'hex'),
    ]
    const witness = scriptSolution
      .concat(tapLeafNoteScript.script)
      .concat(tapLeafNoteScript.controlBlock)

    const finalScriptWitness = witnessStackToScriptWitness(witness)

    return {
      finalScriptWitness,
    }
  }
  psbt_new.finalizeInput(0, getNoteFinalScripts)

  for (let i = 1; i < psbt_new.inputCount; i++) {
    psbt_new.finalizeInput(i)
  }
  return psbt_new.extractTransaction()
}

export function addPsbtPayUtxos(pubkey: Buffer, psbt: Psbt, utxos: IUtxo[], network: Network) {
  let totalInput = 0
  for (const utxo of utxos) {
    const xOnlyPubkey = toXOnly(pubkey)

    if (utxo.type === 'P2WPKH') {
      const input = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        sequence: MAX_SEQUENCE, // These are defaults. This line is not needed.
        witnessUtxo: {
          script: Buffer.from(utxo.script, 'hex'),
          value: utxo.satoshis,
        },
      }
      psbt.addInput(input)
      totalInput += utxo.satoshis
    } else if (utxo.type === 'P2WSH') {
      const redeem = payments.p2pkh({
        pubkey,
        network,
      })
      const redeemScript = redeem?.output

      const input = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        sequence: MAX_SEQUENCE, // These are defaults. This line is not needed.
        witnessUtxo: {
          script: Buffer.from(utxo.script, 'hex'),
          value: utxo.satoshis,
        },
        witnessScript: redeemScript, //. A Buffer of the witnessScript for P2WSH
      }
      psbt.addInput(input)
      totalInput += utxo.satoshis
    } else if (utxo.type === 'P2TR') {
      const input = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        sequence: MAX_SEQUENCE, // These are defaults. This line is not needed.
        witnessUtxo: {
          script: Buffer.from(utxo.script, 'hex'),
          value: utxo.satoshis,
        },
        tapInternalKey: xOnlyPubkey,
      }
      psbt.addInput(input)
      totalInput += utxo.satoshis
    } else if (utxo.type === 'P2TR-NOTE') {
      const p2note = generateP2TRNoteInfo(pubkey, network)
      const tapLeafP2PKScript = {
        leafVersion: p2note.p2pkRedeem.redeemVersion,
        script: p2note.p2pkRedeem.output,
        controlBlock: p2note.p2pkP2TR.witness![p2note.p2pkP2TR.witness!.length - 1]!,
      }

      const input = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        sequence: MAX_SEQUENCE,
        witnessUtxo: {
          script: p2note.p2pkP2TR.output!,
          value: utxo.satoshis,
        },
        tapLeafScript: [tapLeafP2PKScript],
      }
      psbt.addInput(input)
      totalInput += utxo.satoshis
    }
  }
  return totalInput
}
