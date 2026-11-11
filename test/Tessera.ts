import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syntheticAddress } from "@rome-protocol/sdk";
import { Keypair } from "@solana/web3.js";
import { bytesToHex, getAddress, parseEther, type Address, type Hex } from "viem";
import { network } from "hardhat";
import { claimDigest, newEventKey, signClaim } from "../lib/signing";

const HOUR = 60 * 60;

describe("Tessera", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [organizer, attendee, other] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  async function deploy() {
    return viem.deployContract("Tessera");
  }
  type Tessera = Awaited<ReturnType<typeof deploy>>;

  async function write(contract: Tessera, from: Address, functionName: string, args: readonly unknown[] = []) {
    const wallet = await viem.getWalletClient(from);
    const hash = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args,
    } as never);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async function now() {
    return Number((await publicClient.getBlock()).timestamp);
  }

  async function createEvent(contract: Tessera, options: { start?: number; length?: number; max?: number } = {}) {
    const key = newEventKey();
    const start = (await now()) + (options.start ?? -60);
    await write(contract, organizer.account.address, "createEvent", [
      "Rome Builder Night",
      "Ship something both wallet worlds can use.",
      "Hanoi",
      BigInt(start),
      BigInt(start + (options.length ?? 4 * HOUR)),
      options.max ?? 0,
      key.signer,
    ]);
    return { ...key, id: (await contract.read.eventCount()) as bigint };
  }

  async function signatureFor(contract: Tessera, eventKey: Hex, eventId: bigint, who: Address) {
    return signClaim(eventKey, claimDigest(chainId, contract.address, eventId, who));
  }

  async function solanaSigner() {
    const keypair = Keypair.generate();
    const address = getAddress(syntheticAddress(keypair.publicKey));
    await testClient.impersonateAccount({ address });
    await testClient.setBalance({ address, value: parseEther("10") });
    return { address, pubkey: bytesToHex(keypair.publicKey.toBytes()) };
  }

  type EventView = { evmClaims: number; solanaClaims: number; signer: Address; closed: boolean; name: string };

  it("matches the frontend claim digest", async () => {
    const tessera = await deploy();
    const event = await createEvent(tessera);
    assert.equal(
      await tessera.read.claimDigest([event.id, attendee.account.address]),
      claimDigest(chainId, tessera.address, event.id, attendee.account.address),
    );
  });

  it("validates event input", async () => {
    const tessera = await deploy();
    const { signer } = newEventKey();
    const start = BigInt(await now());
    const bad: [unknown[], RegExp][] = [
      [["", "", "", start, start + 100n, 0, signer], /EmptyValue|reverted/],
      [["x".repeat(81), "", "", start, start + 100n, 0, signer], /TextTooLong|reverted/],
      [["Name", "", "x".repeat(121), start, start + 100n, 0, signer], /TextTooLong|reverted/],
      [["Name", "", "", start, start + 100n, 0, "0x0000000000000000000000000000000000000000"], /InvalidAddress|reverted/],
      [["Name", "", "", start, start, 0, signer], /InvalidWindow|reverted/],
      [["Name", "", "", start - 200n, start - 100n, 0, signer], /InvalidWindow|reverted/],
      [["Name", "", "", start, start + BigInt(30 * 24 * HOUR + 1), 0, signer], /InvalidWindow|reverted/],
    ];
    for (const [args, pattern] of bad) {
      await assert.rejects(() => write(tessera, organizer.account.address, "createEvent", args), pattern);
    }
  });

  it("issues one badge per address with a valid event signature", async () => {
    const tessera = await deploy();
    const event = await createEvent(tessera);
    const signature = await signatureFor(tessera, event.key, event.id, attendee.account.address);

    await write(tessera, attendee.account.address, "claim", [event.id, signature]);
    await assert.rejects(
      () => write(tessera, attendee.account.address, "claim", [event.id, signature]),
      /AlreadyClaimed|reverted/,
    );

    const info = (await tessera.read.getEvent([event.id])) as EventView;
    assert.equal(info.evmClaims, 1);
    assert.ok(((await tessera.read.claimedAt([event.id, attendee.account.address])) as bigint) > 0n);
    const badges = (await tessera.read.badgesOf([attendee.account.address, 0n, 10n])) as readonly {
      eventId: bigint;
      solana: boolean;
    }[];
    assert.equal(badges.length, 1);
    assert.equal(badges[0].eventId, event.id);
    assert.equal(badges[0].solana, false);
  });

  it("rejects signatures for another wallet, another key, or malformed bytes", async () => {
    const tessera = await deploy();
    const event = await createEvent(tessera);
    const forOther = await signatureFor(tessera, event.key, event.id, other.account.address);
    const wrongKey = await signatureFor(tessera, newEventKey().key, event.id, attendee.account.address);

    await assert.rejects(
      () => write(tessera, attendee.account.address, "claim", [event.id, forOther]),
      /InvalidSignature|reverted/,
    );
    await assert.rejects(
      () => write(tessera, attendee.account.address, "claim", [event.id, wrongKey]),
      /InvalidSignature|reverted/,
    );
    await assert.rejects(
      () => write(tessera, attendee.account.address, "claim", [event.id, "0x1234"]),
      /InvalidSignature|reverted/,
    );
  });

  it("enforces the claim window, capacity, and early close", async () => {
    const tessera = await deploy();
    const future = await createEvent(tessera, { start: HOUR });
    await assert.rejects(
      async () =>
        write(tessera, attendee.account.address, "claim", [
          future.id,
          await signatureFor(tessera, future.key, future.id, attendee.account.address),
        ]),
      /EventNotStarted|reverted/,
    );

    const small = await createEvent(tessera, { max: 1 });
    await write(tessera, attendee.account.address, "claim", [
      small.id,
      await signatureFor(tessera, small.key, small.id, attendee.account.address),
    ]);
    await assert.rejects(
      async () =>
        write(tessera, other.account.address, "claim", [
          small.id,
          await signatureFor(tessera, small.key, small.id, other.account.address),
        ]),
      /EventFull|reverted/,
    );

    const closing = await createEvent(tessera);
    await assert.rejects(
      () => write(tessera, attendee.account.address, "closeEvent", [closing.id]),
      /NotOrganizer|reverted/,
    );
    await write(tessera, organizer.account.address, "closeEvent", [closing.id]);
    await assert.rejects(
      async () =>
        write(tessera, attendee.account.address, "claim", [
          closing.id,
          await signatureFor(tessera, closing.key, closing.id, attendee.account.address),
        ]),
      /EventClosed|reverted/,
    );

    const ending = await createEvent(tessera, { length: 2 * HOUR });
    await testClient.increaseTime({ seconds: 2 * HOUR });
    await testClient.mine({ blocks: 1 });
    await assert.rejects(
      async () =>
        write(tessera, attendee.account.address, "claim", [
          ending.id,
          await signatureFor(tessera, ending.key, ending.id, attendee.account.address),
        ]),
      /EventClosed|reverted/,
    );
  });

  it("rotates the event key so old QR codes stop working", async () => {
    const tessera = await deploy();
    const event = await createEvent(tessera);
    const next = newEventKey();
    const oldSignature = await signatureFor(tessera, event.key, event.id, attendee.account.address);

    await assert.rejects(
      () => write(tessera, attendee.account.address, "rotateSigner", [event.id, next.signer]),
      /NotOrganizer|reverted/,
    );
    await write(tessera, organizer.account.address, "rotateSigner", [event.id, next.signer]);
    await assert.rejects(
      () => write(tessera, attendee.account.address, "claim", [event.id, oldSignature]),
      /InvalidSignature|reverted/,
    );
    await write(tessera, attendee.account.address, "claim", [
      event.id,
      await signatureFor(tessera, next.key, event.id, attendee.account.address),
    ]);
    assert.equal(((await tessera.read.getEvent([event.id])) as EventView).signer, next.signer);
  });

  it("proves Solana claims from the Rome synthetic address", async () => {
    const tessera = await deploy();
    const event = await createEvent(tessera);
    const solana = await solanaSigner();
    const signature = await signatureFor(tessera, event.key, event.id, solana.address);

    await assert.rejects(
      () => write(tessera, attendee.account.address, "claimAsSolana", [event.id, signature, solana.pubkey]),
      /NotSolanaSigner|reverted/,
    );
    await write(tessera, solana.address, "claimAsSolana", [event.id, signature, solana.pubkey]);

    const info = (await tessera.read.getEvent([event.id])) as EventView;
    assert.equal(info.solanaClaims, 1);
    assert.equal(info.evmClaims, 0);
    const [badge] = (await tessera.read.badgesOf([solana.address, 0n, 1n])) as readonly { solana: boolean }[];
    assert.equal(badge.solana, true);
  });

  it("pages events and badges newest first", async () => {
    const tessera = await deploy();
    const events = [];
    for (let index = 0; index < 3; index++) events.push(await createEvent(tessera));
    for (const event of events) {
      await write(tessera, attendee.account.address, "claim", [
        event.id,
        await signatureFor(tessera, event.key, event.id, attendee.account.address),
      ]);
    }
    const eventIds = ((await tessera.read.getEvents([0n, 2n])) as readonly { id: bigint }[]).map((item) => item.id);
    assert.deepEqual(eventIds, [3n, 2n]);
    const badgeIds = ((await tessera.read.badgesOf([attendee.account.address, 1n, 5n])) as readonly {
      eventId: bigint;
    }[]).map((item) => item.eventId);
    assert.deepEqual(badgeIds, [2n, 1n]);
    assert.equal(await tessera.read.badgeCount([attendee.account.address]), 3n);
    await assert.rejects(() => tessera.read.getEvents([0n, 26n]), /LimitTooLarge|reverted/);
  });
});
