import { createPublicClient, encodeFunctionData, http, type Address, type Hex } from "viem";
import { tesseraAbi } from "./abi";
import { TESSERA_ADDRESS, hadrian } from "./config";
import type { Badge, TesseraEvent } from "./types";

export const publicClient = createPublicClient({
  chain: hadrian,
  transport: http(),
});

export const PAGE_SIZE = 25;

type RawEvent = {
  id: bigint;
  organizer: Address;
  signer: Address;
  name: string;
  description: string;
  location: string;
  createdAt: bigint;
  startsAt: bigint;
  endsAt: bigint;
  maxClaims: number;
  evmClaims: number;
  solanaClaims: number;
  closed: boolean;
};

function requireContract() {
  if (!TESSERA_ADDRESS) {
    throw new Error("Tessera is running in preview mode. Configure NEXT_PUBLIC_TESSERA_ADDRESS.");
  }
  return TESSERA_ADDRESS;
}

export function toEvent(raw: RawEvent): TesseraEvent {
  return {
    id: raw.id,
    organizer: raw.organizer,
    signer: raw.signer,
    name: raw.name,
    description: raw.description,
    location: raw.location,
    createdAt: Number(raw.createdAt),
    startsAt: Number(raw.startsAt),
    endsAt: Number(raw.endsAt),
    maxClaims: Number(raw.maxClaims),
    evmClaims: Number(raw.evmClaims),
    solanaClaims: Number(raw.solanaClaims),
    closed: raw.closed,
  };
}

export async function loadEvents(offset = 0): Promise<TesseraEvent[]> {
  const raw = await publicClient.readContract({
    address: requireContract(),
    abi: tesseraAbi,
    functionName: "getEvents",
    args: [BigInt(offset), BigInt(PAGE_SIZE)],
  });
  return raw.map(toEvent);
}

export async function loadEvent(id: bigint): Promise<TesseraEvent> {
  const raw = await publicClient.readContract({
    address: requireContract(),
    abi: tesseraAbi,
    functionName: "getEvent",
    args: [id],
  });
  return toEvent(raw);
}

export async function loadClaimedAt(eventId: bigint, attendee: Address): Promise<number> {
  const value = await publicClient.readContract({
    address: requireContract(),
    abi: tesseraAbi,
    functionName: "claimedAt",
    args: [eventId, attendee],
  });
  return Number(value);
}

export async function loadBadges(attendee: Address): Promise<Badge[]> {
  const raw = await publicClient.readContract({
    address: requireContract(),
    abi: tesseraAbi,
    functionName: "badgesOf",
    args: [attendee, 0n, BigInt(PAGE_SIZE)],
  });
  return raw.map((item) => ({
    eventId: item.eventId,
    claimedAt: Number(item.claimedAt),
    solana: item.solana,
  }));
}

export function encodeCreateEvent(input: {
  name: string;
  description: string;
  location: string;
  startsAt: number;
  endsAt: number;
  maxClaims: number;
  signer: Address;
}): Hex {
  return encodeFunctionData({
    abi: tesseraAbi,
    functionName: "createEvent",
    args: [
      input.name,
      input.description,
      input.location,
      BigInt(input.startsAt),
      BigInt(input.endsAt),
      input.maxClaims,
      input.signer,
    ],
  });
}

export function encodeClaim(eventId: bigint, signature: Hex, solanaPubkey?: Hex): Hex {
  return solanaPubkey
    ? encodeFunctionData({
        abi: tesseraAbi,
        functionName: "claimAsSolana",
        args: [eventId, signature, solanaPubkey],
      })
    : encodeFunctionData({ abi: tesseraAbi, functionName: "claim", args: [eventId, signature] });
}

export function encodeRotateSigner(eventId: bigint, signer: Address): Hex {
  return encodeFunctionData({
    abi: tesseraAbi,
    functionName: "rotateSigner",
    args: [eventId, signer],
  });
}

export function encodeCloseEvent(eventId: bigint): Hex {
  return encodeFunctionData({ abi: tesseraAbi, functionName: "closeEvent", args: [eventId] });
}
