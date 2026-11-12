"use client";

import { ArrowLeft, ArrowUpRight, Check, Copy, Download, LoaderCircle, MapPin, RefreshCw, Ban } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { TESSERA_ADDRESS, VIA_BASE_URL, isPreviewMode, shortAddress } from "@/lib/config";
import { encodeCloseEvent, encodeRotateSigner, loadClaimedAt, loadEvent } from "@/lib/contract";
import { demoEvents } from "@/lib/demo-data";
import {
  eventDescription,
  eventStatus,
  formatUtc,
  isDemoEvent,
  isFull,
  readEventKey,
  saveEventKey,
  totalClaims,
} from "@/lib/events";
import { claimUrl, newEventKey, signerOf } from "@/lib/signing";
import type { TesseraEvent } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { DemoPill, LaneLegend, LaneSplit, QrCode, StatusPill } from "./ui";
import { useRomeWallet } from "./wallet-provider";

export function EventDetail({ eventId }: { eventId: bigint }) {
  const wallet = useRomeWallet();
  const now = useNow();
  const [event, setEvent] = useState<TesseraEvent | null>(
    isPreviewMode ? (demoEvents.find((item) => item.id === eventId) ?? null) : null,
  );
  const [loading, setLoading] = useState(!isPreviewMode);
  const [missing, setMissing] = useState(isPreviewMode && !event);
  const [eventKey, setEventKey] = useState<Hex | null>(null);
  const [claimedAt, setClaimedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    loadEvent(eventId)
      .then((next) => !cancelled && setEvent(next))
      .catch(() => !cancelled && setMissing(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    void Promise.resolve().then(() => setEventKey(readEventKey(eventId)));
  }, [eventId]);

  useEffect(() => {
    if (isPreviewMode || !wallet.activeAddress) return;
    let cancelled = false;
    loadClaimedAt(eventId, wallet.activeAddress)
      .then((value) => !cancelled && setClaimedAt(value))
      .catch(() => !cancelled && setClaimedAt(0));
    return () => {
      cancelled = true;
    };
  }, [eventId, wallet.activeAddress]);

  const refresh = async () => setEvent(await loadEvent(eventId));

  const rotate = async () => {
    setError(null);
    const next = newEventKey();
    try {
      await wallet.executeCall(encodeRotateSigner(eventId, next.signer));
      saveEventKey(eventId, next.key);
      setEventKey(next.key);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The event key could not be replaced.");
    }
  };

  const close = async () => {
    setError(null);
    try {
      await wallet.executeCall(encodeCloseEvent(eventId));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The event could not be closed.");
    }
  };

  if (loading) {
    return (
      <main className="shell detail">
        <p><LoaderCircle className="spin" /> Loading event from Hadrian…</p>
      </main>
    );
  }
  if (missing || !event) {
    return (
      <main className="shell detail">
        <div>
          <Link className="back-link" href="/"><ArrowLeft size={15} /> All events</Link>
          <h1>Event not found.</h1>
          <p className="detail-description">Event #{eventId.toString()} does not exist on this contract.</p>
        </div>
      </main>
    );
  }

  const total = totalClaims(event);
  const isOrganizer = wallet.activeAddress?.toLowerCase() === event.organizer.toLowerCase();
  const keyIsCurrent = eventKey !== null && signerOf(eventKey).toLowerCase() === event.signer.toLowerCase();
  const ended = now !== null && eventStatus(event, now) === "ended";

  return (
    <main className="shell detail">
      <div>
        <Link className="back-link" href="/"><ArrowLeft size={15} /> All events</Link>
        <p className="eyebrow">Event #{event.id.toString()}</p>
        <h1>{event.name}</h1>
        <div className="event-facts">
          <StatusPill event={event} />
          {isDemoEvent(event) && <DemoPill />}
          {event.location && <span className="event-location"><MapPin size={13} /> {event.location}</span>}
        </div>
        {eventDescription(event) && <p className="detail-description">{eventDescription(event)}</p>}

        <div className="attendance">
          <div className="option-head">
            <span>{total} checked in{event.maxClaims > 0 ? ` of ${event.maxClaims}` : ""}</span>
            {isFull(event) && <small>Capacity reached</small>}
          </div>
          <LaneSplit evm={event.evmClaims} solana={event.solanaClaims} />
          <LaneLegend evm={event.evmClaims} solana={event.solanaClaims} />
        </div>

        {claimedAt > 0 && (
          <div className="ballot-note" style={{ marginTop: 18 }}>
            Your active wallet holds this badge.{" "}
            <Link href={`/passport/${wallet.activeAddress}`}>Open your passport</Link>
          </div>
        )}

        {keyIsCurrent && eventKey && !ended && <OrganizerQr eventId={eventId} eventKey={eventKey} />}
        {eventKey && !keyIsCurrent && (
          <p className="notice" style={{ marginTop: 18 }}>
            The event key saved on this device was replaced. Use the device that rotated it, or rotate again.
          </p>
        )}
        {error && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      </div>

      <aside className="side-card">
        <dl>
          <div><dt>Check-in opens</dt><dd>{formatUtc(event.startsAt)}</dd></div>
          <div><dt>Check-in closes</dt><dd>{formatUtc(event.endsAt)}</dd></div>
          <div><dt>Organizer</dt><dd>{shortAddress(event.organizer)}</dd></div>
          <div><dt>Event key</dt><dd>{shortAddress(event.signer)}</dd></div>
        </dl>
        {isOrganizer && !ended && (
          <>
            <button className="button" onClick={() => void rotate()} disabled={wallet.isBusy}>
              <RefreshCw size={15} /> {eventKey ? "Rotate QR code" : "Create a new QR code"}
            </button>
            <button className="button" onClick={() => void close()} disabled={wallet.isBusy}>
              <Ban size={15} /> Close check-in now
            </button>
          </>
        )}
        {!isOrganizer && !keyIsCurrent && !ended && (
          <p className="detail-description" style={{ margin: 0 }}>
            Scan the QR code shown at the venue to claim your badge.
          </p>
        )}
        {TESSERA_ADDRESS && (
          <a className="button" href={`${VIA_BASE_URL}/address/${TESSERA_ADDRESS}`} target="_blank" rel="noreferrer">
            Verify on Via <ArrowUpRight size={15} />
          </a>
        )}
      </aside>
    </main>
  );
}

function OrganizerQr({ eventId, eventKey }: { eventId: bigint; eventKey: Hex }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setLink(claimUrl(window.location.origin, eventId, eventKey)));
  }, [eventId, eventKey]);

  if (!link) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const download = async () => {
    const QRCode = (await import("qrcode")).default;
    const url = await QRCode.toDataURL(link, { margin: 2, width: 1024 });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tessera-event-${eventId.toString()}.png`;
    anchor.click();
  };

  return (
    <section className="qr-panel" aria-label="Check-in QR code">
      <div>
        <p className="eyebrow">Organizer only</p>
        <h2>Show this at the door.</h2>
        <p className="detail-description">
          Anyone who scans it while check-in is open can claim a badge for their own wallet. Keep it
          off social media, and rotate it if it leaks.
        </p>
        <div className="hero-actions">
          <button className="button" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Copy claim link"}
          </button>
          <button className="button" onClick={() => void download()}>
            <Download size={15} /> Download QR
          </button>
        </div>
      </div>
      <QrCode value={link} label={`Check-in QR code for event ${eventId.toString()}`} />
    </section>
  );
}
