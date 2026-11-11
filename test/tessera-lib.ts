import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syntheticAddress } from "@rome-protocol/sdk";
import { Keypair } from "@solana/web3.js";
import { getAddress, keccak256, recoverMessageAddress } from "viem";
import {
  eventStatus,
  isFull,
  relativeTime,
  solanaPubkeyHex,
  statusLabel,
  validateEventInput,
} from "../lib/events";
import { claimDigest, claimUrl, newEventKey, parseClaimKey, signClaim } from "../lib/signing";
import type { TesseraEvent } from "../lib/types";

const contract = "0x00000000000000000000000000000000000000aa";
const attendee = "0x00000000000000000000000000000000000000bb";

function event(overrides: Partial<TesseraEvent> = {}): TesseraEvent {
  return {
    id: 1n,
    organizer: attendee,
    signer: attendee,
    name: "Meetup",
    description: "",
    location: "",
    createdAt: 0,
    startsAt: 100,
    endsAt: 200,
    maxClaims: 0,
    evmClaims: 0,
    solanaClaims: 0,
    closed: false,
    ...overrides,
  };
}

describe("claim links and signatures", () => {
  it("round-trips the event key through the QR link fragment", () => {
    const { key } = newEventKey();
    const url = claimUrl("https://tessera.example", 7n, key);
    assert.match(url, /^https:\/\/tessera\.example\/claim\/7#k=[0-9a-f]{64}$/);
    assert.equal(parseClaimKey(new URL(url).hash), key);
    assert.equal(parseClaimKey("#k=123"), null);
    assert.equal(parseClaimKey(""), null);
  });

  it("signs a digest that recovers to the event signer", async () => {
    const { key, signer } = newEventKey();
    const digest = claimDigest(200010, contract, 3n, attendee);
    const signature = await signClaim(key, digest);
    assert.equal(signature.length, 132);
    assert.equal(await recoverMessageAddress({ message: { raw: digest }, signature }), signer);
    assert.notEqual(digest, claimDigest(200010, contract, 3n, contract));
  });

  it("encodes the Solana pubkey Rome derives the attendee from", () => {
    const keypair = Keypair.generate();
    const pubkey = solanaPubkeyHex(keypair.publicKey.toBase58());
    assert.equal(
      getAddress(`0x${keccak256(pubkey).slice(-40)}`),
      getAddress(syntheticAddress(keypair.publicKey)),
    );
  });
});

describe("event helpers", () => {
  it("derives status, capacity, and labels", () => {
    assert.equal(eventStatus(event(), 50), "upcoming");
    assert.equal(eventStatus(event(), 150), "open");
    assert.equal(eventStatus(event(), 200), "ended");
    assert.equal(eventStatus(event({ closed: true }), 150), "ended");
    assert.equal(isFull(event({ maxClaims: 2, evmClaims: 1, solanaClaims: 1 })), true);
    assert.equal(isFull(event({ maxClaims: 0, evmClaims: 9 })), false);
    assert.equal(statusLabel(event({ closed: true }), 150), "Closed by organizer");
    assert.equal(statusLabel(event({ endsAt: 150 + 3600 }), 150), "Closes in 1h 0m");
    assert.equal(relativeTime(130, 100), "in 1m");
    assert.equal(statusLabel(event({ endsAt: 150 + 90 * 86400 }), 150), "Open now");
    assert.equal(relativeTime(100 + 2 * 3600 + 300, 100), "in 2h 5m");
    assert.equal(relativeTime(100, 100 + 86400 + 3600), "1d 1h ago");
  });

  it("validates event input against on-chain limits", () => {
    const valid = { name: "Meetup", description: "", location: "", startsAt: 100, endsAt: 200, maxClaims: 0, now: 50 };
    assert.equal(validateEventInput(valid), null);
    assert.match(validateEventInput({ ...valid, name: " " }) ?? "", /name/);
    assert.match(validateEventInput({ ...valid, endsAt: 100 }) ?? "", /after it starts/);
    assert.match(validateEventInput({ ...valid, now: 300 }) ?? "", /future/);
    assert.match(validateEventInput({ ...valid, endsAt: 100 + 31 * 86400 }) ?? "", /30 days/);
    assert.match(validateEventInput({ ...valid, maxClaims: 1.5 }) ?? "", /whole number/);
    assert.match(validateEventInput({ ...valid, location: "Đ".repeat(61) }) ?? "", /120-byte/);
  });
});
