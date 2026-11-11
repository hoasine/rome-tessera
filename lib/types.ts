import type { Address } from "viem";

export interface TesseraEvent {
  id: bigint;
  organizer: Address;
  signer: Address;
  name: string;
  description: string;
  location: string;
  createdAt: number;
  startsAt: number;
  endsAt: number;
  maxClaims: number;
  evmClaims: number;
  solanaClaims: number;
  closed: boolean;
}

export type EventStatus = "upcoming" | "open" | "ended";

export interface Badge {
  eventId: bigint;
  claimedAt: number;
  solana: boolean;
}

export type TransactionState =
  | { status: "idle" }
  | { status: "preparing"; message: string }
  | { status: "signing"; message: string }
  | { status: "confirming"; message: string; hash?: `0x${string}` }
  | { status: "success"; message: string; hash?: `0x${string}` }
  | { status: "error"; message: string };
