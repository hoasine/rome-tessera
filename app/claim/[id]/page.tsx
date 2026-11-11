import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClaimPage } from "@/components/claim-page";

async function ClaimRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <ClaimPage eventId={BigInt(id)} />;
}

export default function Claim({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="shell claim"><p>Loading check-in…</p></main>}>
      <ClaimRoute params={params} />
    </Suspense>
  );
}
