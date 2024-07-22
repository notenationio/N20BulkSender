import type { AxiosError, AxiosResponse } from 'axios'
import axios from 'axios'

import type { IBroadcastResult, IFees, IToken, IUtxo } from './n20_types'

export class Urchain {
  private _httpClient
  constructor(host: string, apiKey = '1234567890') {
    this._httpClient = axios.create({
      baseURL: host,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  }

  _parseResponse(response: AxiosResponse) {
    return response.data
  }

  _parseError(error: AxiosError) {
    if (error.response) {
      // server return error
      console.log(
        '🚀 ~ file: urchain.ts:32 ~ Urchain ~ _parseError',
        `${error.config?.baseURL}${error.config?.url}`,
        error.response.status,
        error.response.headers,
        error.response.data
      )
      throw new Error(JSON.stringify(error.response.data))
    } else if (error.request) {
      // console.warn( error.message )
      throw new Error(error.message)
    } else {
      // console.warn( 'Error', error )
      throw error
    }
  }

  _get(command: string, params: any) {
    // Create query with given parameters, if applicable
    params = params || {}

    const options = {
      params,
    }

    return this._httpClient.get(command, options).then(this._parseResponse).catch(this._parseError)
  }

  _post(command: string, data: any) {
    const options = {
      headers: {
        'Content-Type': 'application/json',
      },
    }

    return this._httpClient
      .post(command, data, options)
      .then(this._parseResponse)
      .catch(this._parseError)
  }

  async health(): Promise<string> {
    return await this._get('health', {})
  }

  async getFeePerKb(): Promise<IFees> {
    return await this._get('fee-per-kb', {})
  }

  balance(scriptHash: string): Promise<{
    confirmed: bigint
    unconfirmed: bigint
  }> {
    return this._post('balance', {
      scriptHash,
    })
  }

  tokenBalance(
    scriptHash: string,
    tick: string
  ): Promise<{
    confirmed: bigint
    unconfirmed: bigint
  }> {
    return this._post('token-balance', {
      scriptHash,
      tick,
    })
  }

  async utxos(scriptHashs: string[], _satoshis?: bigint): Promise<IUtxo[]> {
    return await this._post('utxos', {
      scriptHashs,
      ...(typeof _satoshis !== 'undefined' ? { satoshis: _satoshis } : {}),
    })
  }

  async tokenutxos(scriptHashs: string[], tick: string, amount?: bigint) {
    return await this._post('token-utxos', {
      scriptHashs,
      tick,
      ...(typeof amount !== 'undefined' ? { amount: amount.toString() } : {}),
    })
  }

  async broadcast(rawHex: string): Promise<IBroadcastResult> {
    return await this._post('broadcast', {
      rawHex,
    })
  }

  async tokenInfo(tick: string) {
    return await this._post('token-info', { tick })
  }

  tokenList(scriptHash: string): Promise<IToken[]> {
    return this._post('token-list', {
      scriptHash,
    })
  }
}
