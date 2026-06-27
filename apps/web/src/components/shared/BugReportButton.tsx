'use client';

import { useState, useEffect } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [issueUrl, setIssueUrl] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function reset() {
    setTitle('');
    setDescription('');
    setStatus('idle');
    setIssueUrl('');
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          pageUrl: window.location.href,
        }),
      });
      const data = await res.json() as { ok?: boolean; issueUrl?: string; error?: string };
      if (data.ok) {
        setStatus('success');
        setIssueUrl(data.issueUrl ?? '');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-xs font-medium px-3 py-2 rounded-full shadow-lg transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Report a bug
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6">
            {status === 'success' ? (
              <div className="text-center py-4 space-y-3">
                <div className="text-3xl">✓</div>
                <p className="font-semibold text-zinc-100">Report submitted</p>
                <p className="text-sm text-zinc-400">Thanks! A GitHub issue was created.</p>
                {issueUrl && (
                  <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:underline">
                    View issue →
                  </a>
                )}
                <button onClick={reset} className="mt-4 text-sm text-zinc-500 hover:text-zinc-300">Close</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-100">Report a bug</h3>
                  <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">&times;</button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">What went wrong? <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={200}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Person page crashes on Q76"
                    disabled={status === 'loading'}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">More detail <span className="text-zinc-600">(optional)</span></label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, what you expected to see…"
                    disabled={status === 'loading'}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 disabled:opacity-50 resize-none"
                  />
                </div>

                <p className="text-[11px] text-zinc-600">
                  Current page URL will be included automatically. This creates a public GitHub issue.
                </p>

                {status === 'error' && (
                  <p className="text-xs text-red-400">Something went wrong — please try again.</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === 'loading' || title.trim().length < 5}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {status === 'loading' ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
