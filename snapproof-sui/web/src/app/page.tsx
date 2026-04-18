'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Search } from 'lucide-react';

export default function Home() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    setError('');

    // If the user pasted a full URL, pull out the final segment.
    let target = raw;
    if (target.includes('/p/')) target = target.split('/p/')[1].split(/[?#]/)[0];
    else if (target.includes('/h/')) target = target.split('/h/')[1].split(/[?#]/)[0];

    // Route by shape:
    //   0x-prefixed long ID → object page
    //   64-char lowercase hex → hash page
    if (/^0x[0-9a-fA-F]{60,66}$/.test(target)) {
      router.push(`/p/${target}`);
    } else if (/^[0-9a-fA-F]{64}$/.test(target)) {
      router.push(`/h/${target.toLowerCase()}`);
    } else {
      setError(
        'Paste either a Sui object ID (starts with 0x) or a 64-character image hash.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white selection:bg-[#e94560] selection:text-white flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-[#16213e] rounded-full flex items-center justify-center mb-8 shadow-lg border border-[#0f3460]">
        <ShieldCheck className="w-10 h-10 text-[#4ecca3]" />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-center">
        SnapProof Verifier
      </h1>

      <p className="text-[#888] text-lg mb-12 max-w-md text-center">
        Verify the cryptographic integrity of any photo anchored on the Sui blockchain.
      </p>

      <form onSubmit={handleSearch} className="w-full max-w-lg relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[#888]" />
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste Proof Object ID, image hash, or URL..."
          className="w-full bg-[#16213e] border border-[#0f3460] rounded-xl py-4 pl-12 pr-28 text-white placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-[#e94560] focus:border-transparent transition-all shadow-inner"
        />
        <button
          type="submit"
          className="absolute inset-y-2 right-2 bg-[#e94560] hover:bg-[#d63d56] text-white px-6 rounded-lg font-medium transition-colors"
        >
          Verify
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-[#ff6b6b] max-w-md text-center">{error}</p>
      )}

      <p className="mt-8 text-xs text-[#555] max-w-md text-center">
        Tip: the mobile app&apos;s receipt screen has a &ldquo;Copy Link&rdquo; button that produces a verified URL.
      </p>
    </div>
  );
}
