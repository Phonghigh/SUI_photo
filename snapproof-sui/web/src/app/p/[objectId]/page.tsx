import { Metadata } from 'next';
import { getProofById, WALRUS_AGGREGATOR_URL } from '@/lib/sui';
import ClientVerifier from './ClientVerifier';
import { ShieldCheck, Calendar, User, Fingerprint } from 'lucide-react';

export const revalidate = 60; // Revalidate every 60 seconds

type Props = {
  params: Promise<{ objectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const proof = await getProofById(resolvedParams.objectId);
  if (!proof) {
    return { title: 'Proof Not Found | SnapProof' };
  }

  return {
    title: `Verified Photo Proof | SnapProof`,
    description: `Photo captured and anchored on Sui by ${proof.creator.slice(0, 6)}...${proof.creator.slice(-4)}`,
    openGraph: {
      title: 'Verified Photo Proof | SnapProof',
      description: `Cryptographic proof that this photo existed on ${new Date(proof.createdAt).toLocaleDateString()}`,
      images: [`${WALRUS_AGGREGATOR_URL}/v1/${proof.walrusBlobId}`],
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export default async function ProofPage({ params }: Props) {
  const resolvedParams = await params;
  const proof = await getProofById(resolvedParams.objectId);

  if (!proof) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white p-4">
        <div className="text-center">
          <ShieldCheck className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Proof Not Found</h1>
          <p className="text-gray-400">This proof may not exist or the ID is incorrect.</p>
        </div>
      </div>
    );
  }

  const imageUrl = `${WALRUS_AGGREGATOR_URL}/v1/${proof.walrusBlobId}`;
  const dateStr = new Date(proof.createdAt).toLocaleString();
  const shortCreator = `${proof.creator.slice(0, 8)}...${proof.creator.slice(-6)}`;

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white selection:bg-[#e94560] selection:text-white pb-20">
      {/* Header */}
      <header className="bg-[#16213e] border-b border-[#0f3460] py-4 px-6 sticky top-0 z-10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#e94560] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">SnapProof</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-8">
        {/* Verification Card */}
        <div className="bg-[#16213e] border border-[#0f3460] rounded-2xl overflow-hidden shadow-2xl mb-8">
          
          {/* Image Container */}
          <div className="aspect-auto max-h-[60vh] bg-black relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imageUrl} 
              alt="Verified Snapshot" 
              className="max-h-[60vh] object-contain w-full"
            />
          </div>

          {/* Details Section */}
          <div className="p-6 md:p-8">
            
            {/* Client-side verifier component does the hashing */}
            <ClientVerifier 
              imageUrl={imageUrl} 
              expectedHash={proof.imageHash} 
            />

            <div className="space-y-4 mt-8">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#888] mt-0.5" />
                <div>
                  <p className="text-xs text-[#888] uppercase tracking-wider font-semibold">Captured Date</p>
                  <p className="font-medium">{dateStr}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-[#888] mt-0.5" />
                <div>
                  <p className="text-xs text-[#888] uppercase tracking-wider font-semibold">Submitted By</p>
                  <p className="font-mono text-sm break-all text-[#ccc]">{proof.creator}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-[#888] mt-0.5" />
                <div>
                  <p className="text-xs text-[#888] uppercase tracking-wider font-semibold">On-Chain Hash</p>
                  <p className="font-mono text-xs break-all text-[#4ecca3]">{proof.imageHash}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4">
          <a 
            href={`https://suiscan.xyz/testnet/object/${proof.objectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#0f3460] text-center py-3 rounded-xl font-semibold text-[#5dade2] hover:bg-[#113d70] transition-colors"
          >
            View on Sui Explorer
          </a>
        </div>
      </main>
    </div>
  );
}
