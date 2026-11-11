"use client";

import { ArrowLeft, BadgeCheck, LoaderCircle, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { TESSERA_ADDRESS, hadrian, isPreviewMode } from "@/lib/config";
import { encodeClaim, loadClaimedAt, loadEvent } from "@/lib/contract";
import { demoEvents } from "@/lib/demo-data";
import { eventStatus, isFull, solanaPubkeyHex, statusLabel } from "@/lib/events";
import { claimDigest, parseClaimKey, signClaim, signerOf } from "@/lib/signing";
import type { TesseraEvent } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRomeWallet } from "./wallet-provider";

export function ClaimPage({ eventId }: { eventId: bigint }) {
  const wallet = useRomeWallet();
  const now = useNow();
  const [eventKey, setEventKey] = useState<Hex | null | undefined>(undefined);
  const [event, setEvent] = useState<TesseraEvent | null>(
    isPreviewMode ? (demoEvents.find((item) => item.id === eventId) ?? null) : null,
  );
  const [missing, setMissing] = useState(isPreviewMode && !event);
  const [claimedAt, setClaimedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setEventKey(parseClaimKey(window.location.hash));
    void Promise.resolve().then(read);
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    loadEvent(eventId)
      .then((next) => !cancelled && setEvent(next))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
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

  const claim = async () => {
    setError(null);
    if (!eventKey || !event) return;
    if (!wallet.activeAddress) return setError("Connect MetaMask or Solflare first.");
    if (!TESSERA_ADDRESS) return setError("Preview mode is read-only. Claims work once the contract is deployed.");
    try {
      const digest = claimDigest(hadrian.id, TESSERA_ADDRESS, eventId, wallet.activeAddress);
      const signature = await signClaim(eventKey, digest);
      const proof =
        wallet.activeLane === "solana" && wallet.solanaAddress
          ? solanaPubkeyHex(wallet.solanaAddress)
          : undefined;
      await wallet.executeCall(encodeClaim(eventId, signature, proof));
      setClaimedAt(Math.floor(Date.now() / 1000));
      setEvent(await loadEvent(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your badge could not be claimed.");
    }
  };

  if (eventKey === undefined || (!event && !missing)) {
    return (
      <main className="shell claim">
        <p><LoaderCircle className="spin" /> Reading your check-in link…</p>
      </main>
    );
  }
  if (missing || !event) {
    return (
      <main className="shell claim">
        <h1>Event not found.</h1>
        <p className="detail-description">This check-in link points to an event that does not exist.</p>
        <Link className="button" href="/"><ArrowLeft size={15} /> All events</Link>
      </main>
    );
  }

  const status = now === null ? null : eventStatus(event, now);
  const keyProblem = !eventKey
    ? "This link is missing its check-in code. Scan the QR code at the venue again."
    : signerOf(eventKey).toLowerCase() !== event.signer.toLowerCase()
      ? "This QR code was replaced by the organizer. Scan the current one at the venue."
      : null;
  const blocker =
    keyProblem ??
    (status === "upcoming" && now !== null
      ? `Check-in ${statusLabel(event, now).toLowerCase()}.`
      : status === "ended"
        ? "Check-in for this event has ended."
        : isFull(event)
          ? "This event has reached its capacity."
          : null);

  return (
    <main className="shell claim">
      <div className="claim-card">
        <p className="eyebrow">Check in · Event #{event.id.toString()}</p>
        <h1>{event.name}</h1>
        {event.location && <p className="detail-description">{event.location}</p>}

        {claimedAt > 0 ? (
          <div className="claim-success" role="status">
            <BadgeCheck size={28} />
            <div>
              <strong>You&apos;re checked in.</strong>
              <p>
                The badge is in your {wallet.activeLane === "solana" ? "Solana" : "EVM"} passport.{" "}
                {wallet.activeAddress && <Link href={`/passport/${wallet.activeAddress}`}>View passport</Link>}
              </p>
            </div>
          </div>
        ) : blocker ? (
          <p className="notice" role="alert">{blocker}</p>
        ) : !wallet.activeAddress ? (
          <div className="claim-connect">
            <p>Connect the wallet that should hold your badge.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => void wallet.connectEvm().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "MetaMask connection failed."))}>
                <Wallet size={16} /> MetaMask
              </button>
              <button className="button button-primary" onClick={() => void wallet.connectSolana().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Solflare connection failed."))}>
                <Sparkles size={16} /> Solflare
              </button>
            </div>
          </div>
        ) : (
          <div className="claim-connect">
            <p>
              Claiming as {wallet.activeLane === "solana" ? "a proven Solana wallet" : "an EVM wallet"}. One signature,
              one badge per wallet.
            </p>
            <button className="button button-primary button-large" onClick={() => void claim()} disabled={wallet.isBusy}>
              <BadgeCheck size={17} /> {wallet.isBusy ? "Claiming…" : "Claim my badge"}
            </button>
          </div>
        )}
        {error && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
        <Link className="back-link" href={`/event/${event.id.toString()}`} style={{ marginTop: 22 }}>
          Event details
        </Link>
      </div>
    </main>
  );
}
