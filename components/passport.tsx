"use client";

import { BadgeCheck, Check, Copy, LoaderCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { isPreviewMode, shortAddress } from "@/lib/config";
import { loadBadges, loadEvent } from "@/lib/contract";
import { demoBadges, demoEvents } from "@/lib/demo-data";
import { formatUtc } from "@/lib/events";
import type { Badge, TesseraEvent } from "@/lib/types";

type Stamp = Badge & { event: TesseraEvent | null };

export function Passport({ address }: { address: Address }) {
  const [stamps, setStamps] = useState<Stamp[] | null>(
    isPreviewMode
      ? demoBadges.map((badge) => ({ ...badge, event: demoEvents.find((item) => item.id === badge.eventId) ?? null }))
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    loadBadges(address)
      .then((badges) =>
        Promise.all(
          badges.map(async (badge) => ({ ...badge, event: await loadEvent(badge.eventId).catch(() => null) })),
        ),
      )
      .then((next) => !cancelled && setStamps(next))
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not read this passport.");
          setStamps([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Passport</p>
          <h2>{shortAddress(address, 6)}</h2>
          <p className="detail-description">
            Check-in badges held by this Rome address. Badges cannot be transferred.
          </p>
        </div>
        <button className="button" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Share passport"}
        </button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="poll-grid">
        {stamps === null ? (
          <div className="empty-state"><LoaderCircle className="spin" /> Loading badges…</div>
        ) : stamps.length ? (
          stamps.map((stamp) => (
            <Link className="poll-card stamp" key={stamp.eventId.toString()} href={`/event/${stamp.eventId.toString()}`}>
              <div className="poll-meta">
                <span>Event #{stamp.eventId.toString()}</span>
                <span className={`status ${stamp.solana ? "status-solana" : "status-evm"}`}>
                  {stamp.solana ? "Proven Solana" : "EVM"}
                </span>
              </div>
              <h3><BadgeCheck size={20} /> {stamp.event?.name ?? "Unknown event"}</h3>
              {stamp.event?.location && (
                <span className="event-location"><MapPin size={13} /> {stamp.event.location}</span>
              )}
              <span className="lane-legend">Checked in {formatUtc(stamp.claimedAt)}</span>
            </Link>
          ))
        ) : (
          <div className="empty-state">No badges yet. Scan an event QR code to collect one.</div>
        )}
      </div>
    </main>
  );
}
