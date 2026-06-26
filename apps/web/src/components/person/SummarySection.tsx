'use client';

import { useState, useEffect } from 'react';

interface Props {
  wikidataQid: string;
  displayName: string;
}

export function SummarySection({ wikidataQid, displayName }: Props) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/summary/${wikidataQid}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { text?: string } | null) => {
        if (!cancelled && data?.text) setText(data.text);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [wikidataQid]);

  if (text === null) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-24 h-3 bg-zinc-800 rounded" />
        </div>
        <div className="space-y-2">
          <div className="w-full h-3 bg-zinc-800 rounded" />
          <div className="w-5/6 h-3 bg-zinc-800 rounded" />
          <div className="w-4/6 h-3 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          AI Summary · {displayName}
        </span>
      </div>
      <p className="text-zinc-200 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
