import type { AxiosError, AxiosResponse } from 'axios'
import axios from 'axios'

import type { IMemPoolFee } from './n20_types'

export class Mempool {
  private _httpClient
  constructor(host: string) {
    this._httpClient = axios.create({
      baseURL: host,
    })
  }

  _parseResponse(response: AxiosResponse) {
    return response.data
  }

  _parseError(error: AxiosError) {
    if (error.response) {
      // server return error
      console.log(
        '🚀 ~ file: urchain.ts:143 ~ Mempool ~ _parseError',
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

  async getFeePerKb(): Promise<IMemPoolFee> {
    return await this._get('fees/recommended', {})
  }
}
