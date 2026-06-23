'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function NavBar() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-b from-[#0a0a0a] to-transparent backdrop-blur-sm border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 font-black text-white text-xl tracking-tight">
          <span className="text-red-600">P</span>AI
        </Link>

        {/* Search bar — center */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-zinc-800/80 text-zinc-100 placeholder-zinc-500 rounded-full pl-9 pr-4 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-red-600 focus:bg-zinc-800 transition-colors"
            />
          </div>
        </form>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-5 text-sm font-medium text-zinc-400">
          <Link href="/browse" className="hover:text-white transition-colors">Browse</Link>
          <Link href="/?sort=trending_24h" className="hover:text-white transition-colors">Trending</Link>
          <Link href="/methodology" className="hover:text-white transition-colors">Methodology</Link>
        </div>
      </div>
    </nav>
  );
}
