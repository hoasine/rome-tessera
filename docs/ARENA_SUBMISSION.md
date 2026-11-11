# Tessera — Arena submission

## App name

Tessera

## One line

Check-in badges that MetaMask and Solflare users claim with one QR code, with Solana attendance proven on-chain

## What are you building?

One QR code at the door, both wallet worlds. An organizer creates an event and shows a QR code. Attendees scan it with MetaMask or Solflare and receive a non-transferable check-in badge in the same Solidity contract on Rome Hadrian.

The QR carries a throwaway event key that signs each attendee's own address, so a claim cannot be replayed for another wallet. Solflare users claim through Rome without an EVM key, and the contract proves their attendance by checking that the sender is the synthetic address derived from their Solana public key. Organizers see a verifiable EVM / Solana attendance split, and every wallet gets a shareable passport of badges.

## Kind

Both

## Why Rome

Rome lets a Solana wallet sign a call to a Solidity contract and share its state with MetaMask users, so one event serves both communities with one contract and no bridge. The deterministic synthetic address is what lets the contract prove which attendees came from Solana.

## Completed features

- Event creation with a check-in window, capacity, and location
- QR code, claim link, and PNG download; key rotation and early close
- Signature-bound claims, one badge per address, non-transferable
- Proven Solana claims via `claimAsSolana`
- Attendance split by wallet type; shareable passport pages
- Live Hadrian status; labelled preview mode

## Quality

- 8 contract tests: digest parity with the frontend, input limits, signatures for other wallets or keys rejected, window and capacity, key rotation, early close, Solana claims from a real Solana keypair, pagination
- Unit tests for claim links, signature recovery, the Solana pubkey encoding, and event helpers
- Playwright smoke tests on desktop and mobile with a mocked MetaMask session
- GitHub Actions: lint, typecheck, tests, build, browser tests, dependency audit

## Links

- Website: `https://rome-tessera.vercel.app`
- GitHub: `https://github.com/hoasine/rome-tessera`
- X: `https://x.com/HoaTranRom`
- Contract: `ADD_CONTRACT_ADDRESS`
- Deployment transaction: `ADD_DEPLOY_TX`
- Demo video: `ADD_VIDEO_URL`

## Grant application

What is the grant for:

```
Bring Tessera to real Rome events, in three milestones:

1. Rubicon launch (2 weeks): deploy and verify on Rubicon, switch to a Solana mainnet RPC, and test both wallet lanes end to end.

2. Organizer tools (4 weeks): time-rotating QR codes that refresh every minute, CSV export of attendees, and an attendee-gated perk check other contracts can call.

3. Event pilots and gas sponsorship (4 weeks): sponsor check-in gas so a first badge costs attendees nothing, and run check-in at 5 Rome workshops or meetups, targeting 300+ badges with at least a third from proven Solana wallets.

Funds cover Rubicon gas, gas sponsorship, a paid Solana mainnet RPC, and development time. Tessera holds no user funds.
```

Does your app hold user funds: No.
