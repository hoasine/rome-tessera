# Tessera

Tessera issues on-chain check-in badges that MetaMask and Solflare users claim by scanning one QR code at an event. One Solidity contract on Rome Hadrian records who attended, and proves which attendees came from Solana wallets.

![CI](https://github.com/hoasine/rome-tessera/actions/workflows/check.yml/badge.svg)

## How check-in works

1. The organizer creates an event. Their browser generates a throwaway event key; only its public address (`signer`) is stored on-chain. The private key stays on the organizer's device.
2. The venue shows a QR code for `/claim/<id>#k=<event key>`. The fragment after `#` is never sent to a server.
3. An attendee scans it. The app signs `keccak256(abi.encode(chainId, contract, eventId, attendee))` with the event key, as an EIP-191 message, and the attendee's wallet submits it.
4. The contract recovers the signer with `ecrecover` and issues a non-transferable badge. Because the signature covers the attendee's own address, a claim seen in the mempool cannot be replayed for another wallet.

Solflare users call `claimAsSolana(eventId, signature, pubkey)` through Rome. The contract checks that `msg.sender` is the Rome synthetic address `keccak256(pubkey)[12:]`, so the EVM / Solana attendance split is proven rather than reported by the website.

## Features

- Events with a check-in window up to 30 days, an optional capacity, and a location
- One badge per address per event; badges cannot be transferred
- QR code, copyable claim link, and PNG download for the organizer
- Rotate the event key to invalidate a leaked QR code, or close check-in early
- Attendance split into EVM and proven Solana badges
- `/passport/<address>` lists every badge a Rome address holds
- Live Hadrian status and a labelled read-only preview

## Trust model

- Anyone holding the QR code while check-in is open can claim a badge for their own wallet. Keep the code off social media, use short windows and capacities, and rotate the key if it leaks.
- The event key lives in the organizer's browser storage. Losing it is not fatal: the organizer wallet can rotate to a new key.
- No owner, no upgrades, no funds.

## Contract

`contracts/Tessera.sol`, Solidity 0.8.28:

- `createEvent(name, description, location, startsAt, endsAt, maxClaims, signer)`
- `claim(eventId, signature)` and `claimAsSolana(eventId, signature, solanaPubkey)`
- `rotateSigner(eventId, newSigner)` and `closeEvent(eventId)`, organizer only
- `claimDigest(eventId, attendee)`, `syntheticAddressOf(solanaPubkey)`
- `getEvent`, `getEvents(offset, limit)` and `badgesOf(attendee, offset, limit)` newest first, `claimedAt`, `badgeCount`

Signatures must be 65 bytes with a low `s` value.

## Local development

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

```bash
npm run check          # lint, typecheck, contract + unit tests, production build
npx playwright install chromium
npm run test:e2e       # desktop + mobile smoke tests against the preview build
```

## Deploy

```bash
npm run deploy:secure    # Hadrian testnet
npm run deploy:rubicon   # Rubicon mainnet, real USDC gas
```

Each command asks for the key with hidden input, deploys, prints the deployment transaction hash for Arena, writes `deployments/<network>.json`, and verifies the source on Rome's Sourcify. Then configure:

```bash
NEXT_PUBLIC_TESSERA_ADDRESS=0x...
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

See [`docs/ARENA_SUBMISSION.md`](docs/ARENA_SUBMISSION.md) and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
