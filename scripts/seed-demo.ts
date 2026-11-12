import { existsSync, readFileSync, writeFileSync } from "node:fs";
import hardhat from "hardhat";
import {
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tesseraAbi } from "../lib/abi";
import { hadrian } from "../lib/config";
import { encodeClaim, encodeCloseEvent, encodeCreateEvent } from "../lib/contract";
import { DEMO_EVENT_PREFIX } from "../lib/events";
import { claimDigest, claimUrl, newEventKey, signClaim } from "../lib/signing";

const HADRIAN_TESSERA = "0x6cF4510F1CD406d739939bb140356BE6e17A898b" as const;
const APP_URL = "https://rome-tessera.vercel.app";
const STATE_FILE = ".demo-seed.json";
// Hadrian charges for Solana compute, so even small calls reserve several million gas.
const GAS_BUFFER = parseEther("0.2");
const HOUR = 3600;
const DAY = 24 * HOUR;

type Wallet = ReturnType<typeof createWalletClient> & { address: Address };

const organizers = ["aurora", "solstice"] as const;
const attendees = ["lan", "diego", "aiko", "priya", "minh", "sara", "tomas", "ngoc"] as const;
type Persona = (typeof organizers)[number] | (typeof attendees)[number];

interface Scenario {
  key: string;
  organizer: (typeof organizers)[number];
  name: string;
  description: string;
  location: string;
  opensIn: number;
  lasts: number;
  capacity: number;
  claimers: (typeof attendees)[number][];
  close?: boolean;
}

const scenarios: Scenario[] = [
  {
    key: "builder-night",
    organizer: "aurora",
    name: "Rome Builder Night · Hanoi",
    description: "Lightning demos of apps that serve MetaMask and Solflare users from one contract.",
    location: "Hanoi, Vietnam",
    opensIn: -HOUR,
    lasts: 21 * DAY,
    capacity: 120,
    claimers: ["lan", "diego", "aiko", "priya", "minh", "sara"],
  },
  {
    key: "meetup-hcmc",
    organizer: "solstice",
    name: "Solana x EVM Meetup · Ho Chi Minh City",
    description: "Community meetup on shared liquidity and dual-lane apps.",
    location: "Ho Chi Minh City, Vietnam",
    opensIn: -2 * HOUR,
    lasts: 14 * DAY,
    capacity: 80,
    claimers: ["tomas", "ngoc", "lan", "aiko"],
  },
  {
    key: "workshop",
    organizer: "aurora",
    name: "Dual-lane Solidity Workshop",
    description: "Hands-on session: open an EVM contract to Solana wallets in one afternoon.",
    location: "Online",
    opensIn: -3 * HOUR,
    lasts: 7 * DAY,
    capacity: 40,
    claimers: ["diego", "priya", "sara", "minh"],
    close: true,
  },
  {
    key: "office-hours",
    organizer: "solstice",
    name: "Rome Office Hours",
    description: "Weekly Q&A with Rome builders. Check-in opens when the call starts.",
    location: "Discord",
    opensIn: 2 * DAY,
    lasts: 3 * HOUR,
    capacity: 0,
    claimers: [],
  },
];

interface SeedState {
  keys: Partial<Record<Persona, Hex>>;
  events: Record<string, { id?: string; eventKey?: Hex; claimed: string[]; closed?: boolean }>;
}

async function main() {
  const connection = await hardhat.network.create();
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [funder] = await viem.getWalletClients();
  if (!funder) throw new Error("Set PRIVATE_KEY to the funded deployer wallet.");

  const isHadrian = (await publicClient.getChainId()) === hadrian.id;
  let tessera: Address = HADRIAN_TESSERA;
  let state: SeedState = { keys: {}, events: {} };
  if (isHadrian && existsSync(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const save = () => {
    if (isHadrian) writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  };
  if (!isHadrian) {
    console.log("Local dry run: deploying a throwaway Tessera contract.");
    tessera = (await viem.deployContract("Tessera")).address;
  }
  const chainId = await publicClient.getChainId();

  const wallets = {} as Record<Persona, Wallet>;
  for (const persona of [...organizers, ...attendees]) {
    state.keys[persona] ??= generatePrivateKey();
    const account = privateKeyToAccount(state.keys[persona]!);
    wallets[persona] = Object.assign(
      createWalletClient({ account, chain: publicClient.chain, transport: custom(connection.provider) }),
      { address: account.address },
    );
  }
  save();

  let spent = 0n;
  async function topUp(address: Address, needed: bigint) {
    const balance = await publicClient.getBalance({ address });
    if (balance >= needed) return;
    const value = needed - balance + GAS_BUFFER;
    const available = await publicClient.getBalance({ address: funder!.account.address });
    if (available < value + GAS_BUFFER * 4n) {
      throw new Error(
        `The funder wallet has ${formatEther(available)} USDC left. ` +
          "Bridge more test USDC to it, then run `npm run seed:demo` again to resume.",
      );
    }
    const hash = await funder!.sendTransaction({ to: address, value });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function send(wallet: Wallet, data: Hex) {
    const gas = await publicClient.estimateGas({ account: wallet.account!, to: tessera, data });
    const gasPrice = await publicClient.getGasPrice();
    await topUp(wallet.address, (gas * gasPrice * 12n) / 10n);
    const before = await publicClient.getBalance({ address: wallet.address });
    const hash = await wallet.sendTransaction({
      account: wallet.account!,
      chain: publicClient.chain,
      to: tessera,
      data,
      gas,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Transaction reverted (${hash})`);
    spent += before - (await publicClient.getBalance({ address: wallet.address }));
    return receipt;
  }

  console.log(`Funder ${funder.account.address}: ${formatEther(await publicClient.getBalance({ address: funder.account.address }))} gas`);
  const now = Number((await publicClient.getBlock()).timestamp);

  for (const scenario of scenarios) {
    const progress = (state.events[scenario.key] ??= { claimed: [] });
    const organizer = wallets[scenario.organizer];

    if (!progress.id) {
      const key = newEventKey();
      const startsAt = now + scenario.opensIn;
      await send(
        organizer,
        encodeCreateEvent({
          name: scenario.name,
          description: `${DEMO_EVENT_PREFIX} ${scenario.description}`,
          location: scenario.location,
          startsAt,
          endsAt: startsAt + scenario.lasts,
          maxClaims: scenario.capacity,
          signer: key.signer,
        }),
      );
      const count = await publicClient.readContract({ address: tessera, abi: tesseraAbi, functionName: "eventCount" });
      for (let id = count; id > 0n && id > count - 5n; id--) {
        const info = await publicClient.readContract({ address: tessera, abi: tesseraAbi, functionName: "getEvent", args: [id] });
        if (info.signer.toLowerCase() === key.signer.toLowerCase()) {
          progress.id = id.toString();
          break;
        }
      }
      if (!progress.id) throw new Error(`Created "${scenario.name}" but could not find its id.`);
      progress.eventKey = key.key;
      save();
      console.log(`Event #${progress.id}: ${scenario.name}`);
    }

    const eventId = BigInt(progress.id);
    for (const persona of scenario.claimers) {
      if (progress.claimed.includes(persona)) continue;
      const attendee = wallets[persona];
      const signature = await signClaim(progress.eventKey!, claimDigest(chainId, tessera, eventId, attendee.address));
      await send(attendee, encodeClaim(eventId, signature));
      progress.claimed.push(persona);
      save();
      console.log(`  #${progress.id} badge -> ${persona}`);
    }

    if (scenario.close && !progress.closed) {
      await send(organizer, encodeCloseEvent(eventId));
      progress.closed = true;
      save();
      console.log(`  #${progress.id} closed by organizer`);
    }
  }

  const featured = state.events["builder-night"];
  console.log(`\nDemo wallets spent ${formatEther(spent)} gas on this run.`);
  console.log(`Funder balance: ${formatEther(await publicClient.getBalance({ address: funder.account.address }))} gas`);
  if (featured?.id && featured.eventKey) {
    console.log("\nClaim a real Solana badge yourself: open this link in a browser with Solflare (Devnet):");
    console.log(claimUrl(isHadrian ? APP_URL : "http://localhost:3000", BigInt(featured.id), featured.eventKey));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
