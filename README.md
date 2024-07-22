![n20-bulk-sender-banner](/public/static/images/twitter-card.png)

# N20 Token Bulk Sender

Send N20 tokens in bulk to multiple addresses.

As per the limitations of the <a href="https://noteprotocol.org/">NOTE Protocol</a>, each transaction (TX) can accommodate TOKEN transfers to up to 40 addresses. If the input exceeds 40 addresses, we will group each set of 40 addresses into separate TXs, each signed individually.

Support connect to NOTE BTC network via ChainBow Wallet, Unisat Wallet and NOTEMarket Wallet (via <a href='https://github.com/NoteScan/n20-connect'>n20-connect</a>).

# Installation
Clone the repository to your computer and navigate to the directory:

```bash
git clone https://github.com/notenationio/N20BulkSender
cd N20BulkSender
```

Install third-party packages using NPM or PNPM (recommended):

## NPM
```bash
npm i
```

## PNPM
```bash
pnpm i
```

# Run

## Run with NPM:
```bash
npm run start
```

## Run with PNPM:
```bash
pnpm start
```

Access the application in your web browser at http://localhost:3000.

## Licence

[MIT](https://github.com/notenationio/N20BulkSender/blob/main/LICENSE)

