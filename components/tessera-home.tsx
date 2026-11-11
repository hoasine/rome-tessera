"use client";

import { ArrowRight, ArrowUpRight, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { TESSERA_ADDRESS, VIA_BASE_URL, isPreviewMode } from "@/lib/config";
import { encodeCreateEvent, loadEvents } from "@/lib/contract";
import { demoEvents } from "@/lib/demo-data";
import {
  eventStatus,
  localInputToSeconds,
  saveEventKey,
  secondsToLocalInput,
  validateEventInput,
} from "@/lib/events";
import { newEventKey } from "@/lib/signing";
import type { EventStatus, TesseraEvent } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { EventCard, Modal, useChainHealth } from "./ui";
import { useRomeWallet } from "./wallet-provider";

type Filter = EventStatus | "all";

export function TesseraHome() {
  const health = useChainHealth();
  const now = useNow();
  const [events, setEvents] = useState<TesseraEvent[]>(isPreviewMode ? demoEvents : []);
  const [loading, setLoading] = useState(!isPreviewMode);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isPreviewMode) return;
    loadEvents()
      .then(setEvents)
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : "Could not read events from Hadrian."),
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      events.filter((event) =>
        filter === "all" || now === null ? true : eventStatus(event, now) === filter,
      ),
    [events, filter, now],
  );

  const stats = useMemo(
    () => ({
      events: events.length,
      open: now === null ? null : events.filter((event) => eventStatus(event, now) === "open").length,
      evm: events.reduce((total, event) => total + event.evmClaims, 0),
      solana: events.reduce((total, event) => total + event.solanaClaims, 0),
    }),
    [events, now],
  );

  return (
    <main>
      <section className="shell hero">
        <div>
          <span className={`kicker ${health.online === false ? "offline" : ""}`} data-testid="network-health">
            <span className="dot" />
            {isPreviewMode
              ? "Preview data · read only"
              : health.online === null
                ? "Checking Hadrian…"
                : health.online
                  ? `Live on Hadrian · block ${health.block?.toLocaleString("en-US")}`
                  : "Hadrian RPC unreachable"}
          </span>
          <h1>
            Scan once. <em>Both wallet worlds.</em>
          </h1>
          <p className="hero-copy">
            Tessera gives every attendee an on-chain check-in badge, whether they arrive with
            MetaMask or Solflare. Organizers show one QR code; one contract on Rome records
            who was there and proves which attendees came from Solana.
          </p>
          <div className="hero-actions">
            <button className="button button-primary button-large" onClick={() => setCreating(true)}>
              <Plus size={17} /> Create an event
            </button>
            <a className="button button-large" href="#events">
              Browse events <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <aside className="proof-card">
          <h2>A QR code that cannot be copied onto another wallet.</h2>
          <p>
            The QR holds a throwaway event key. It signs the attendee&apos;s own address, and
            the contract checks that signature, so a claim seen on-chain cannot be replayed
            for anyone else.
          </p>
          <code>
            {"require(\n  ecrecover(digest(event, msg.sender))\n    == event.signer\n)"}
          </code>
        </aside>
      </section>

      <section className="shell stats" aria-label="Tessera statistics">
        <div><strong>{loading ? "—" : stats.events}</strong><span>events</span></div>
        <div><strong>{loading || stats.open === null ? "—" : stats.open}</strong><span>open for check-in</span></div>
        <div><strong>{loading ? "—" : stats.evm}</strong><span>EVM badges</span></div>
        <div><strong>{loading ? "—" : stats.solana}</strong><span>proven Solana badges</span></div>
      </section>

      <section className="shell section" id="events">
        <div className="section-head">
          <div>
            <p className="eyebrow">The register</p>
            <h2>Events on Rome.</h2>
          </div>
          <div className="tabs" role="group" aria-label="Filter events">
            {(["open", "upcoming", "ended", "all"] as const).map((value) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {value === "open" ? "Open now" : value === "upcoming" ? "Upcoming" : value === "ended" ? "Ended" : "All"}
              </button>
            ))}
          </div>
        </div>
        {isPreviewMode && (
          <p className="notice">
            Showing sample events. Configure the deployed contract to read live Hadrian data.
          </p>
        )}
        {notice && <p className="notice" role="alert">{notice}</p>}
        <div className="poll-grid">
          {loading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" /> Loading events from Hadrian…
            </div>
          ) : visible.length ? (
            visible.map((event) => <EventCard key={event.id.toString()} event={event} />)
          ) : (
            <div className="empty-state">No events here yet. Create the first one.</div>
          )}
        </div>
      </section>

      <section className="shell section" id="how-it-works">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>One QR code. Every wallet.</h2>
          </div>
          {TESSERA_ADDRESS && (
            <a
              className="button"
              href={`${VIA_BASE_URL}/address/${TESSERA_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              View contract <ArrowUpRight size={15} />
            </a>
          )}
        </div>
        <div className="steps">
          <article className="step">
            <span>01</span>
            <h3>Open check-in</h3>
            <p>The organizer sets a window and capacity. Their browser creates the event key; only its public address goes on-chain.</p>
          </article>
          <article className="step">
            <span>02</span>
            <h3>Scan at the door</h3>
            <p>Attendees scan the QR with MetaMask or Solflare. Solflare users claim through Rome without an EVM key.</p>
          </article>
          <article className="step">
            <span>03</span>
            <h3>Keep the badge</h3>
            <p>Badges cannot be transferred. Every wallet gets a passport page, and Solana attendance is proven by the contract.</p>
          </article>
        </div>
      </section>

      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
    </main>
  );
}

function CreateEventModal({ onClose }: { onClose(): void }) {
  const wallet = useRomeWallet();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [defaults] = useState(() => {
    const start = Math.floor(Date.now() / 60000) * 60;
    return { start: secondsToLocalInput(start), end: secondsToLocalInput(start + 3 * 3600) };
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      location: String(data.get("location") ?? "").trim(),
      startsAt: localInputToSeconds(String(data.get("startsAt") ?? "")),
      endsAt: localInputToSeconds(String(data.get("endsAt") ?? "")),
      maxClaims: Number(data.get("maxClaims") || 0),
    };
    const validation = validateEventInput({ ...input, now: Math.floor(Date.now() / 1000) });
    if (validation) return setError(validation);
    if (!wallet.activeAddress) return setError("Connect MetaMask or Solflare to sign the event.");
    setError(null);

    const key = newEventKey();
    try {
      await wallet.executeCall(encodeCreateEvent({ ...input, signer: key.signer }));
      const created = (await loadEvents()).find(
        (item) => item.signer.toLowerCase() === key.signer.toLowerCase(),
      );
      if (!created) throw new Error("The event was created but could not be found yet. Refresh in a moment.");
      saveEventKey(created.id, key.key);
      router.push(`/event/${created.id.toString()}?created=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The event could not be created.");
    }
  };

  return (
    <Modal
      title="Create an event"
      description="Your browser creates the event key for the QR code. Only its public address is stored on-chain."
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Event name</span>
          <input name="name" maxLength={80} placeholder="Rome Builder Night" required />
        </label>
        <label className="field">
          <span>Location (optional)</span>
          <input name="location" maxLength={120} placeholder="Hanoi, or Online" />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <textarea name="description" maxLength={500} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Check-in opens</span>
            <input name="startsAt" type="datetime-local" defaultValue={defaults.start} required />
          </label>
          <label className="field">
            <span>Check-in closes</span>
            <input name="endsAt" type="datetime-local" defaultValue={defaults.end} required />
          </label>
        </div>
        <label className="field">
          <span>Capacity (0 = unlimited)</span>
          <input name="maxClaims" type="number" min={0} step={1} defaultValue={0} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={wallet.isBusy}>
            {wallet.isBusy ? "Signing…" : "Create event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
