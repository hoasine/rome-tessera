import { encodeAbiParameters, isHex, keccak256, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/** Mirrors Tessera.claimDigest: keccak256(abi.encode(chainId, contract, eventId, attendee)). */
export function claimDigest(
  chainId: number,
  contract: Address,
  eventId: bigint,
  attendee: Address,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "address" }],
      [BigInt(chainId), contract, eventId, attendee],
    ),
  );
}

/** Signs the digest as an EIP-191 personal message with the event key. */
export function signClaim(eventKey: Hex, digest: Hex): Promise<Hex> {
  return privateKeyToAccount(eventKey).signMessage({ message: { raw: digest } });
}

export function newEventKey() {
  const key = generatePrivateKey();
  return { key, signer: privateKeyToAccount(key).address };
}

export function signerOf(eventKey: Hex): Address {
  return privateKeyToAccount(eventKey).address;
}

export function claimUrl(origin: string, eventId: bigint, eventKey: Hex) {
  return `${origin}/claim/${eventId.toString()}#k=${eventKey.slice(2)}`;
}

/** Reads the event key from a claim link fragment such as `#k=<64 hex chars>`. */
export function parseClaimKey(fragment: string): Hex | null {
  const value = new URLSearchParams(fragment.replace(/^#/, "")).get("k") ?? "";
  const key = `0x${value}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) && isHex(key) ? (key as Hex) : null;
}
