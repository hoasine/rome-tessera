import { signerOf } from "./signing";
import type { Badge, TesseraEvent } from "./types";

const base = Math.floor(Date.UTC(2026, 10, 10) / 1000);
const far = 4102444800;

/** Public sample key for the preview event only. It controls nothing on-chain. */
export const DEMO_EVENT_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

export const demoEvents: TesseraEvent[] = [
  {
    id: 3n,
    organizer: "0x7f2D39e2a45D7484aA65f6B63F1f94E2a851D5Af",
    signer: signerOf(DEMO_EVENT_KEY),
    name: "Rome Builder Night · Hanoi",
    description: "Lightning demos of apps that serve MetaMask and Solflare users from one contract.",
    location: "Hanoi, Vietnam",
    createdAt: base - 3600,
    startsAt: base - 1800,
    endsAt: far,
    maxClaims: 120,
    evmClaims: 38,
    solanaClaims: 51,
    closed: false,
  },
  {
    id: 2n,
    organizer: "0x3Fa6E34B41DC1Ce583F64F7B495AD35DdE76E813",
    signer: signerOf(DEMO_EVENT_KEY),
    name: "Dual-lane Solidity Workshop",
    description: "Hands-on session: open your EVM contract to Solana wallets.",
    location: "Online",
    createdAt: base - 86400,
    startsAt: far - 86400,
    endsAt: far,
    maxClaims: 0,
    evmClaims: 0,
    solanaClaims: 0,
    closed: false,
  },
  {
    id: 1n,
    organizer: "0xA8642Fd55193D34FD987D4DeFA60F3a55f7919b0",
    signer: signerOf(DEMO_EVENT_KEY),
    name: "Solana x EVM Meetup",
    description: "Community meetup on shared liquidity.",
    location: "Ho Chi Minh City",
    createdAt: base - 10 * 86400,
    startsAt: base - 9 * 86400,
    endsAt: base - 9 * 86400 + 4 * 3600,
    maxClaims: 80,
    evmClaims: 29,
    solanaClaims: 24,
    closed: false,
  },
];

export const demoBadges: Badge[] = [
  { eventId: 3n, claimedAt: base - 900, solana: true },
  { eventId: 1n, claimedAt: base - 9 * 86400 + 1200, solana: true },
];
