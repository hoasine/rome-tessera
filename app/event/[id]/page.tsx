import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/event-detail";

async function EventRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <EventDetail eventId={BigInt(id)} />;
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="shell detail"><p>Loading event…</p></main>}>
      <EventRoute params={params} />
    </Suspense>
  );
}
