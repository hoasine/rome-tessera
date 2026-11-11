import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { Passport } from "@/components/passport";

async function PassportRoute({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return <Passport address={getAddress(address)} />;
}

export default function PassportPage({ params }: { params: Promise<{ address: string }> }) {
  return (
    <Suspense fallback={<main className="shell section"><p>Loading passport…</p></main>}>
      <PassportRoute params={params} />
    </Suspense>
  );
}
