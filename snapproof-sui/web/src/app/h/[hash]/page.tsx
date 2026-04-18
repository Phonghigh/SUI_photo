import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProofByHash } from '@/lib/sui';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export const revalidate = 30;

type Props = {
  params: Promise<{ hash: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: `Verify Image Hash ${hash.slice(0, 10)}… | SnapProof`,
    description:
      'Looking up the on-chain proof for this image hash in the SnapProof indexer.',
    openGraph: {
      title: 'SnapProof — Verify by Image Hash',
      description: `Hash: ${hash}`,
    },
  };
}

export default async function ByHashPage({ params }: Props) {
  const { hash } = await params;
  const normalized = hash.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-[#e94560] mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Image Hash</h1>
          <p className="text-[#888] mb-6">
            An image hash must be a 64-character lowercase hex string.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#0f3460] hover:bg-[#113d70] text-[#5dade2] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const proof = await getProofByHash(normalized);
  if (proof?.objectId) {
    // Canonicalize on the object URL so deep links work.
    redirect(`/p/${proof.objectId}`);
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white pb-20">
      <header className="bg-[#16213e] border-b border-[#0f3460] py-4 px-6 sticky top-0 z-10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#e94560] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">SnapProof</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-8">
        <div className="bg-[#16213e] border border-[#0f3460] rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-[#e94560] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">No Proof Found</h2>
          <p className="text-[#888] mb-6">
            We searched both the SnapProof indexer and the Sui event log and
            couldn&apos;t find a proof for this hash.
          </p>
          <div className="bg-[#1a1a2e] rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-[#888] uppercase tracking-wider font-semibold mb-2">
              Image Hash
            </p>
            <p className="font-mono text-xs break-all text-[#ccc]">{normalized}</p>
          </div>
          <p className="text-xs text-[#555] mb-6">
            If the photo was just submitted, the indexer may take up to 15 seconds
            to catch up. Try refreshing in a moment.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#0f3460] hover:bg-[#113d70] text-[#5dade2] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Try Another Lookup
          </Link>
        </div>
      </main>
    </div>
  );
}
