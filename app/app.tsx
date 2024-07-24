'use client'

import { WalletConnectReact, useReactWalletStore } from 'n20-connect/dist/react'

import 'n20-connect/dist/style/index.css'
import { useTheme } from 'next-themes'
import ReactSelect from 'react-select'
import N20Wallet from './api'
import type { ISendTarget } from './api/n20_types'
import { interpolate } from './api/n20_utils'

const MAX_ADDRESSES_PER_TX = 40

type Option = string | number
type Options = { [key in Option]: any }

function Tick(wallet?: N20Wallet, onChange?: (Options) => void) {
  if (wallet !== undefined) {
    const token_list: Options[] = []
    wallet.tokenList().then((res) => {
      res.map((token, index) =>
        token_list.push({
          label: token.tick + '\t[' + Number(token.confirmed) / 10 ** token.dec + ']',
          value: token.tick,
        })
      )
    })
    if (token_list) {
      return (
        <ReactSelect
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          options={token_list}
          onChange={onChange}
        />
      )
    } else {
      return <div>No N20 Token found in this wallet.</div>
    }
  } else {
    return <div>Unavailable wallet.</div>
  }
}

let n20_tick: string | undefined = undefined
let n20_wallet: N20Wallet | undefined = undefined

function App() {
  const ext_wallet = useReactWalletStore((state) => state)

  const onConnectSuccess = async (wallet: any) => {
    if (wallet === undefined) {
      alert('N20 wallet not initailized' + wallet.publicKey)
    }
    n20_wallet = new N20Wallet(wallet)
  }

  const onChangeNetwork = async () => {
    if (n20_wallet?.btc_wallet?.network === 'BTCtestnet') {
      n20_wallet?.btc_wallet?.switchNetwork('BTClivenet')
    } else if (n20_wallet?.btc_wallet?.network === 'BTClivenet') {
      n20_wallet?.btc_wallet?.switchNetwork('BTCtestnet')
    } else if (n20_wallet?.btc_wallet?.network === 'livenet') {
      n20_wallet?.btc_wallet?.switchNetwork('testnet')
    } else if (n20_wallet?.btc_wallet?.network === 'testnet') {
      n20_wallet?.btc_wallet?.switchNetwork('livenet')
    }
    window.location.reload()
  }

  const onConnectError = async (error: any) => {
    alert('n20-connect connect error' + error)
  }
  const onDisconnectSuccess = async () => {
    n20_wallet = undefined
  }

  const onBulkTransfer = async () => {
    if (n20_wallet == undefined) {
      alert('Please connect to your wallet first.')
      return false
    }
    if (!n20_tick) {
      alert('Please select a N20 token')
      return false
    }

    // get textarea by id
    const textarea = document.getElementById('address') as HTMLTextAreaElement
    if (!textarea.value) {
      alert('Please input addresses and amounts')
      return false
    }

    const send_button = document.getElementById('bulksend') as HTMLButtonElement
    const result_box = document.getElementById('result') as HTMLDivElement
    const notic_box = document.getElementById('notice') as HTMLDivElement

    send_button.disabled = true

    const token_list = await n20_wallet.tokenList()
    if (!token_list) {
      alert('No N20 token found in this wallet')
      send_button.disabled = false
      return false
    }

    let n20_token_amount = BigInt(0)
    let n20_token_dec = 0

    for (const token of token_list) {
      if (token.tick === n20_tick) {
        n20_token_amount = token.confirmed
        n20_token_dec = token.dec
        break
      }
    }

    // split textarea value by line, each line contain address and amount, seperate by comma
    const lines = textarea.value.split('\n')
    const toAddresses: ISendTarget[] = []

    let totalAmount = BigInt(0)

    for (const line of lines) {
      if (line === '') {
        continue
      }
      const [addr, amt] = line.split(',')
      // check whether address is valid taproot address
      if (
        (n20_wallet.config.network === 'testnet' && !addr.startsWith('tb1p')) ||
        (n20_wallet.config.network === 'livenet' && !addr.startsWith('bc1p'))
      ) {
        alert('Invalid N20 address')
        send_button.disabled = false
        // select the invalid address in textarea
        textarea.setSelectionRange(
          textarea.value.indexOf(addr),
          textarea.value.indexOf(addr) + addr.length
        )
        textarea.focus()
        return false
      }
      const f_amt = parseFloat(amt)
      if (isNaN(f_amt) || f_amt <= 0 || f_amt === undefined) {
        alert('Invalid amount')
        send_button.disabled = false
        // select the invalid amount in textarea
        textarea.setSelectionRange(
          textarea.value.indexOf(addr) + addr.length,
          textarea.value.indexOf(addr) + addr.length
        )
        textarea.focus()
        return false
      }
      const b_amt = BigInt(Math.round(f_amt * 10 ** n20_token_dec))
      totalAmount += b_amt

      if (totalAmount > n20_token_amount) {
        alert('Total amount exceeds your N20 token balance, please remove some lines.')
        send_button.disabled = false
        return false
      }

      toAddresses.push({ address: addr, amount: b_amt })
    }

    let n = 0
    let nTx = 0
    let transedAmount: number = 0

    result_box.innerHTML = ''
    while (n < toAddresses.length) {
      const curAddresses =
        toAddresses.length - n >= MAX_ADDRESSES_PER_TX
          ? toAddresses.slice(n, n + MAX_ADDRESSES_PER_TX)
          : toAddresses.slice(n)

      try {
        const curAmount =
          Number(curAddresses.reduce((a, b) => a + b.amount, BigInt(0))) / 10 ** n20_token_dec
        notic_box.innerHTML =
          'Sending address ' + (n + 1) + ' to ' + (n + curAddresses.length) + '...</br>'
        notic_box.innerHTML += 'Total amount: ' + curAmount.toFixed(n20_token_dec)
        const res = await n20_wallet.sendTokenBatch(n20_tick, curAddresses)
        result_box.innerHTML +=
          '<a href=' +
          interpolate(n20_wallet.config.explorer[0].tx, { txId: res.result.txId }) +
          ' target="_blank">txId:' +
          res.result.txId +
          '</a></br>'
        send_button.disabled = false
        transedAmount += curAmount
        nTx++
      } catch (error) {
        alert('Error: ' + error.message.toString())
        send_button.disabled = false
        break
      }
      n += curAddresses.length
    }
    notic_box.innerHTML =
      'Transfered ' +
      transedAmount.toFixed(n20_token_dec) +
      ' ' +
      n20_tick +
      ' to ' +
      n +
      ' addresses with ' +
      nTx +
      ' TX(s)'
    return false
  }

  const onChange = (selectedOption) => {
    n20_tick = selectedOption.value
  }

  const { theme } = useTheme()

  const onOpenFile = async () => {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement
    fileInput.addEventListener('change', async (e) => {
      console.log('fileInput change')
      const file = fileInput.files![0]
      const reader = new FileReader()
      reader.onload = async (e) => {
        const text = e.target?.result as string
        const textarea = document?.getElementById('address') as HTMLTextAreaElement
        textarea.value = text
      }
      reader.readAsText(file)
    })
    fileInput.click()
  }

  return (
    <>
      <div className="... flex flex-col">
        <div>
          <div className="flex flex-row">
            <div className="basis-3/4">
              {n20_wallet === undefined && (
                <div className="font-mono text-sm text-gray-900 dark:text-white dark:placeholder-gray-400">
                  Please connect your wallet
                </div>
              )}
              {n20_wallet !== undefined && (
                <form className="max-w-sm">{Tick(n20_wallet, onChange)}</form>
              )}
            </div>
            <div className="basis-1/4">
              <div className="continer">
                <WalletConnectReact
                  config={{
                    network: 'BTCtestnet',
                    defaultConnectorId: 'chainbow',
                  }}
                  theme={theme?.includes('dark') ? 'dark' : 'light'}
                  onConnectSuccess={onConnectSuccess}
                  onConnectError={onConnectError}
                  onDisconnectSuccess={onDisconnectSuccess}
                />
              </div>
              {n20_wallet === undefined && (
                <button onClick={() => ext_wallet.setModalVisible(true)}></button>
              )}
              {n20_wallet !== undefined && (
                <div className="text-center font-medium text-blue-500 underline">
                  <a onClick={() => onChangeNetwork()} href="/">
                    {n20_wallet.btc_wallet.network}
                  </a>
                </div>
              )}
            </div>
          </div>
          <div>
            <form>
              <div className="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                <div className="rounded-t-lg bg-white px-4 py-2 dark:bg-gray-800">
                  <label htmlFor="address" className="sr-only">
                    Please input addresses and amounts
                  </label>
                  <textarea
                    id="address"
                    rows={20}
                    className="w-full border-0 bg-white px-0 font-mono text-sm text-gray-900 focus:ring-0 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter address and amount, separate with comma.  "
                    required
                  ></textarea>
                </div>
                <div className="flex items-center justify-between border-t px-3 py-2 dark:border-gray-600">
                  <button
                    id="bulksend"
                    type="button"
                    className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2.5 text-center text-xs font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-800 dark:focus:ring-blue-900"
                    onClick={() => onBulkTransfer()}
                  >
                    <svg
                      className="-ms-1 me-2 h-4 w-4"
                      aria-hidden="true"
                      focusable="false"
                      data-prefix="fab"
                      data-icon="bitcoin"
                      role="img"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 512 512"
                    >
                      <path
                        fill="currentColor"
                        d="M504 256c0 136.1-111 248-248 248S8 392.1 8 256 119 8 256 8s248 111 248 248zm-141.7-35.33c4.937-32.1-20.19-50.74-54.55-62.57l11.15-44.7-27.21-6.781-10.85 43.52c-7.154-1.783-14.5-3.464-21.8-5.13l10.93-43.81-27.2-6.781-11.15 44.69c-5.922-1.349-11.73-2.682-17.38-4.084l.031-.14-37.53-9.37-7.239 29.06s20.19 4.627 19.76 4.913c11.02 2.751 13.01 10.04 12.68 15.82l-12.7 50.92c.76 .194 1.744 .473 2.829 .907-.907-.225-1.876-.473-2.876-.713l-17.8 71.34c-1.349 3.348-4.767 8.37-12.47 6.464 .271 .395-19.78-4.937-19.78-4.937l-13.51 31.15 35.41 8.827c6.588 1.651 13.05 3.379 19.4 5.006l-11.26 45.21 27.18 6.781 11.15-44.73a1038 1038 0 0 0 21.69 5.627l-11.11 44.52 27.21 6.781 11.26-45.13c46.4 8.781 81.3 5.239 95.99-36.73 11.84-33.79-.589-53.28-25-65.99 17.78-4.098 31.17-15.79 34.75-39.95zm-62.18 87.18c-8.41 33.79-65.31 15.52-83.75 10.94l14.94-59.9c18.45 4.603 77.6 13.72 68.81 48.96zm8.417-87.67c-7.673 30.74-55.03 15.12-70.39 11.29l13.55-54.33c15.36 3.828 64.84 10.97 56.85 43.03z"
                      ></path>
                    </svg>
                    Bulk Send
                  </button>
                  <div className="flex space-x-1 ps-0 sm:ps-2 rtl:space-x-reverse">
                    <button
                      type="button"
                      onClick={() => onOpenFile()}
                      className="inline-flex cursor-pointer items-center justify-center rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
                    >
                      <svg
                        className="h-4 w-4"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 12 20"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M1 6v8a5 5 0 1 0 10 0V4.5a3.5 3.5 0 1 0-7 0V13a2 2 0 0 0 4 0V6"
                        />
                      </svg>
                      <input className="sr-only" type="file" id="fileInput" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div className="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
            <div className="rounded-t-lg bg-white px-4 py-2 dark:bg-gray-800">
              <div
                className="w-full border-0 bg-white px-0 font-mono text-sm text-gray-900 focus:ring-0 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                id="notice"
              ></div>
            </div>
          </div>
          <div className="36 mb-4 w-full truncate rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
            <div className="rounded-t-lg bg-white px-4 py-2 dark:bg-gray-800">
              <div
                className="text-center font-mono text-sm text-blue-500 underline"
                id="result"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
