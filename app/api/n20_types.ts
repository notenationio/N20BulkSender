export interface NotePayload {
  data0: string
  data1: string
  data2: string
  data3: string
  data4: string
  locktime?: number //for mint
}

export type AddressType =
  | 'P2PKH'
  | 'P2PK-NOTE'
  | 'P2SH'
  | 'P2SH-NOTE'
  | 'P2WPKH'
  | 'P2WSH'
  | 'P2WSH-NOTE'
  | 'P2TR'
  | 'P2TR-NOTE-V1'
  | 'P2TR-NOTE'
  | 'P2TR-COMMIT-NOTE'

export interface IAddressObject {
  address?: string
  script?: string
  scriptHash: string
  type: AddressType
}

export interface IWalletAccount {
  publicKey: Buffer
  xOnlyPubkey?: string
  mainAddress?: IAddressObject
  tokenAddress?: IAddressObject
  [key: string]: any
}

export interface IScriptObject {
  address?: string
  script: string
  scriptHash: string
  type: AddressType
}

export interface ITransaction {
  txId: string
  txHex: string
  noteUtxo?: IUtxo
  noteUtxos?: IUtxo[]
  payUtxos?: IUtxo[]
  feeRate?: number
}

export interface IUtxo {
  txId: string
  outputIndex: number
  satoshis: number
  script: string
  scriptHash: string
  type: AddressType
  //  privateKeyWif?: string;
  txHex?: string
  sequence?: number
}

export type ITokenUtxo = IUtxo & {
  amount: bigint
}

export interface ISendToScript {
  script: string
  amount: number | bigint
}

export interface ISendToAddress {
  address: string
  amount: number | bigint
}

export interface IFees {
  slowFee: number //about 1 hour, Satoshis/KB
  avgFee: number //about 30 minutes
  fastFee: number //about 10 minutes
}

export interface IMemPoolFee {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
  minimumFee: number
}

export interface ICoinConfig {
  name: string
  symbol: string
  decimal: number
  path: string
  baseSymbol: string
  network: 'livenet' | 'testnet'
  explorer: {
    homepage: string
    tx: string
    address: string
    block: string
    blockheight: string
  }[]
  faucets?: string[]
  P2SH: boolean
  P2PKH: boolean
  P2WSH: boolean
  P2TR: boolean
  minDustThreshold: number
  bip21: string
  urchain: {
    host: string
    apiKey: string
  }
}

export interface IBroadcastResult {
  success: boolean
  txId?: string
  error?: any
}

export interface IToken {
  tick: string
  confirmed: bigint
  unconfirmed: bigint
  scriptHash: string
  dec: number
  p: string
  needUpgrade?: boolean
}

export interface ITransferN20Data {
  p: 'n20'
  op: 'transfer'
  tick: string
  amt: bigint | bigint[]
  [key: string]: any
}

export interface ISendTarget {
  address: string
  amount: bigint
}
