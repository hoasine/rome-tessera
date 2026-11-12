import { PublicKey } from "@solana/web3.js";
import { bytesToHex, type Hex } from "viem";
import type { EventStatus, TesseraEvent } from "./types";

export const MAX_DURATION_SECONDS = 30 * 24 * 60 * 60;

/** Description prefix written by scripts/seed-demo.ts so seeded events are labelled. */
export const DEMO_EVENT_PREFIX = "Demo event ·";

export function isDemoEvent(event: TesseraEvent) {
  return event.description.startsWith(DEMO_EVENT_PREFIX);
}

export function eventDescription(event: TesseraEvent) {
  return isDemoEvent(event)
    ? event.description.slice(DEMO_EVENT_PREFIX.length).trim()
    : event.description;
}

export function eventStatus(event: TesseraEvent, now: number): EventStatus {
  if (event.closed || now >= event.endsAt) return "ended";
  if (now < event.startsAt) return "upcoming";
  return "open";
}

export function totalClaims(event: TesseraEvent) {
  return event.evmClaims + event.solanaClaims;
}

export function isFull(event: TesseraEvent) {
  return event.maxClaims > 0 && totalClaims(event) >= event.maxClaims;
}

export function solanaPubkeyHex(address: string): Hex {
  return bytesToHex(new PublicKey(address).toBytes());
}

export function share(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

export function relativeTime(target: number, now: number) {
  const seconds = Math.abs(Math.floor(target - now));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const span =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
  return target >= now ? `in ${span}` : `${span} ago`;
}

export function statusLabel(event: TesseraEvent, now: number) {
  const status = eventStatus(event, now);
  const distant = (target: number) => target - now > 60 * 86400;
  if (status === "upcoming") {
    return distant(event.startsAt) ? "Upcoming" : `Opens ${relativeTime(event.startsAt, now)}`;
  }
  if (status === "open") {
    if (isFull(event)) return "Full";
    return distant(event.endsAt) ? "Open now" : `Closes ${relativeTime(event.endsAt, now)}`;
  }
  return event.closed ? "Closed by organizer" : "Ended";
}

export function formatUtc(seconds: number) {
  return new Date(seconds * 1000).toUTCString().replace("GMT", "UTC");
}

/** Converts a `datetime-local` input value in the browser's time zone to Unix seconds. */
export function localInputToSeconds(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : NaN;
}

export function secondsToLocalInput(seconds: number) {
  const date = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validateEventInput(input: {
  name: string;
  description: string;
  location: string;
  startsAt: number;
  endsAt: number;
  maxClaims: number;
  now: number;
}) {
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  if (!input.name.trim()) return "Give the event a name.";
  if (bytes(input.name) > 80) return "The name exceeds the 80-byte on-chain limit.";
  if (bytes(input.description) > 500) return "The description exceeds the 500-byte on-chain limit.";
  if (bytes(input.location) > 120) return "The location exceeds the 120-byte on-chain limit.";
  if (!Number.isFinite(input.startsAt) || !Number.isFinite(input.endsAt)) return "Pick a start and end time.";
  if (input.endsAt <= input.startsAt) return "The check-in window must end after it starts.";
  if (input.endsAt <= input.now) return "The check-in window must end in the future.";
  if (input.endsAt - input.startsAt > MAX_DURATION_SECONDS) return "Check-in can stay open for at most 30 days.";
  if (!Number.isInteger(input.maxClaims) || input.maxClaims < 0 || input.maxClaims > 4_294_967_295) {
    return "Capacity must be a whole number, or 0 for unlimited.";
  }
  return null;
}

const keyPrefix = "tessera:event-key:";

export function saveEventKey(eventId: bigint, key: Hex) {
  window.localStorage.setItem(`${keyPrefix}${eventId.toString()}`, key);
}

export function readEventKey(eventId: bigint): Hex | null {
  const value = window.localStorage.getItem(`${keyPrefix}${eventId.toString()}`);
  return value && /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as Hex) : null;
}
