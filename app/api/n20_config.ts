import type { ICoinConfig } from './n20_types'

export const MIN_SATOSHIS = 546

export const NOTE_PROTOCOL_ENVELOPE_ID = 'NOTE'

//4d xx yy bytes
export const MAX_SCRIPT_ELEMENT_SIZE = 520
//4c zz bytes
export const MAX_STANDARD_STACK_ITEM_SIZE = 80
export const MAX_DATA_SEGMENTS = 5

export const MAX_SCRIPT_FULL_SIZE = MAX_SCRIPT_ELEMENT_SIZE * MAX_DATA_SEGMENTS
export const MAX_STACK_FULL_SIZE = MAX_STANDARD_STACK_ITEM_SIZE * MAX_DATA_SEGMENTS

export const MAX_SEQUENCE = 0xffffffff
export const MAX_LOCKTIME = 0xffffffff

export const URCHAIN_KEY = process.env.URCHAIN_KEY
  ? process.env.URCHAIN_KEY.replace(/^"|"$/g, '')
  : '1234567890'

export const BTC_URCHAIN_HOST = process.env.BTC_URCHAIN_HOST
  ? process.env.BTC_URCHAIN_HOST.replace(/^"|"$/g, '')
  : 'https://btc.urchain.com/api/'

export const BTC_URCHAIN_HOST_TESTNET = process.env.BTC_URCHAIN_HOST_TESTNET
  ? process.env.BTC_URCHAIN_HOST_TESTNET.replace(/^"|"$/g, '')
  : 'https://btc-testnet4.urchain.com/api/'

export const coins_config: ICoinConfig[] = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimal: 8,
    path: "m/44'/0'/0'",
    baseSymbol: 'Satoshi',
    network: 'livenet',
    explorer: [
      {
        homepage: 'https://explorer.noteprotocol.org/',
        tx: 'https://explorer.noteprotocol.org/transaction?txId=${txId}&blockchain=BTClivenet',
        address: 'https://explorer.noteprotocol.org/address?q=${address}&blockchain=BTClivenet',
        block: 'https://explorer.noteprotocol.org/block?hash=${blockHash}&blockchain=BTClivenet',
        blockheight:
          'https://explorer.noteprotocol.org/block?height=${blockHeight}&blockchain=BTClivenet',
      },
      {
        homepage: 'https://mempool.space/',
        tx: 'https://mempool.space/tx/${txId}',
        address: 'https://mempool.space/address/${address}',
        block: 'https://mempool.space/block/${blockHash}',
        blockheight: 'https://mempool.space/block/${blockHeight}',
      },
      {
        homepage: 'https://blockstream.info/',
        tx: 'https://blockstream.info/tx/${txId}',
        address: 'https://blockstream.info/address/${address}',
        block: 'https://blockstream.info/block/${blockHash}',
        blockheight: 'https://blockstream.info/block-height/${blockHeight}',
      },
    ],
    P2SH: true,
    P2PKH: true,
    P2WSH: true,
    P2TR: true,
    minDustThreshold: 546,
    bip21: '',
    urchain: {
      host: BTC_URCHAIN_HOST,
      apiKey: URCHAIN_KEY,
    },
  },
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimal: 8,
    path: "m/44'/1'/0'",
    baseSymbol: 'Satoshi',
    network: 'testnet',
    explorer: [
      {
        homepage: 'https://testnet4.noteprotocol.org/',
        tx: 'https://testnet4.noteprotocol.org/transaction?txId=${txId}&blockchain=BTCtestnet',
        address: 'https://testnet4.noteprotocol.org/address?q=${address}&blockchain=BTCtestnet',
        block: 'https://testnet4.noteprotocol.org/block?hash=${blockHash}&blockchain=BTCtestnet',
        blockheight:
          'https://testnet4.noteprotocol.org/block?height=${blockHeight}&blockchain=BTCtestnet',
      },
      {
        homepage: 'https://mempool.space/testnet4/',
        tx: 'https://mempool.space/testnet4/tx/${txId}',
        address: 'https://mempool.space/testnet4/address/${address}',
        block: 'https://mempool.space/testnet4/block/${blockHash}',
        blockheight: 'https://mempool.space/testnet4/block/${blockHeight}',
      },
    ],
    faucets: ['https://testnet4.anyone.eu.org/', 'https://mempool.space/testnet4/faucet'],
    P2SH: true,
    P2PKH: true,
    P2WSH: true,
    P2TR: true,
    minDustThreshold: 546,
    bip21: '',
    urchain: {
      host: BTC_URCHAIN_HOST_TESTNET,
      apiKey: URCHAIN_KEY,
    },
  },
]
