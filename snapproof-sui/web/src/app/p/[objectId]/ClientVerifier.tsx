'use client';

import { useState, useEffect } from 'react';
import { hashArrayBuffer } from '@/lib/hash';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Props {
  imageUrl: string;
  expectedHash: string;
}

export default function ClientVerifier({ imageUrl, expectedHash }: Props) {
  const [status, setStatus] = useState<'verifying' | 'matched' | 'mismatched' | 'error'>('verifying');

  useEffect(() => {
    let mounted = true;

    async function verify() {
      try {
        // Fetch the raw bytes from Walrus
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Failed to fetch image from Walrus');
        
        const buffer = await response.arrayBuffer();
        
        // Hash the bytes natively in the browser
        const computedHash = await hashArrayBuffer(buffer);

        if (!mounted) return;

        if (computedHash === expectedHash) {
          setStatus('matched');
        } else {
          setStatus('mismatched');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Verification error:', err);
        setStatus('error');
      }
    }

    verify();

    return () => {
      mounted = false;
    };
  }, [imageUrl, expectedHash]);

  return (
    <div className={`p-4 rounded-xl border ${
      status === 'verifying' ? 'bg-[#0f3460]/20 border-[#0f3460]' :
      status === 'matched' ? 'bg-[#1a3a2e] border-[#4ecca3]/30' :
      'bg-[#3a1a2e] border-[#ff6b6b]/30'
    }`}>
      
      {status === 'verifying' && (
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#5dade2] animate-spin" />
          <div>
            <p className="font-semibold text-white">Verifying integrity...</p>
            <p className="text-sm text-[#888]">Hashing raw bytes directly in your browser</p>
          </div>
        </div>
      )}

      {status === 'matched' && (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-[#4ecca3]" />
          <div>
            <p className="font-semibold text-[#4ecca3]">Cryptographically Verified</p>
            <p className="text-sm text-[#a8d5c4]">The image bytes perfectly match the on-chain record.</p>
          </div>
        </div>
      )}

      {status === 'mismatched' && (
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-[#ff6b6b]" />
          <div>
            <p className="font-semibold text-[#ff6b6b]">Verification Failed</p>
            <p className="text-sm text-[#d5a8a8]">The image does not match the on-chain record.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-[#ff6b6b]" />
          <div>
            <p className="font-semibold text-[#ff6b6b]">Verification Error</p>
            <p className="text-sm text-[#d5a8a8]">Could not download the image from Walrus to verify.</p>
          </div>
        </div>
      )}

    </div>
  );
}
