import varuint from 'varuint-bitcoin'
import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'

import { MAX_DATA_SEGMENTS, MAX_SCRIPT_ELEMENT_SIZE, NOTE_PROTOCOL_ENVELOPE_ID } from './n20_config'

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

export function splitBufferIntoSegments(
  buffer: Buffer,
  segmentSize = MAX_SCRIPT_ELEMENT_SIZE,
  maxSegments = MAX_DATA_SEGMENTS
): Buffer[] {
  if (buffer.length / segmentSize > maxSegments) {
    throw new Error(`Buffer size exceeds the maximum allowed number of segments (${maxSegments}).`)
  }

  const segments: Buffer[] = []
  let i = 0
  while (i < buffer.length) {
    const start = i
    const end = Math.min((i += segmentSize), buffer.length)
    const segment = buffer.subarray(start, end)
    segments.push(Buffer.from(segment))
  }

  return segments
}

export function interpolate(template: string, params: any) {
  const names = Object.keys(params)
  const vals = Object.values(params)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(...names, `return \`${template}\`;`)(...vals)
}

export function buildNoteScript(xOnlyPubkey: Buffer) {
  //4e4f5445 -> NOTE
  const scriptASM = `${Buffer.from(NOTE_PROTOCOL_ENVELOPE_ID, 'utf8').toString(
    'hex'
  )} OP_2DROP OP_2DROP OP_2DROP ${xOnlyPubkey.toString('hex')} OP_CHECKSIG`
  return scriptASM
}

/**
 * Helper function that produces a serialized witness script
 * https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts#L477
 */
export function witnessStackToScriptWitness(witness: Buffer[]) {
  let buffer = Buffer.allocUnsafe(0)

  function writeSlice(slice: Buffer) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)])
  }

  function writeVarInt(i: number) {
    const currentLen = buffer.length
    const varintLen = varuint.encodingLength(i)

    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)])
    varuint.encode(i, buffer, currentLen)
  }

  function writeVarSlice(slice: Buffer) {
    writeVarInt(slice.length)
    writeSlice(slice)
  }

  function writeVector(vector: Buffer[]) {
    writeVarInt(vector.length)
    vector.forEach(writeVarSlice)
  }

  writeVector(witness)

  return buffer
}

export function toXOnly(pubkey: Buffer): Buffer {
  return Buffer.from(pubkey.subarray(1, 33))
}
