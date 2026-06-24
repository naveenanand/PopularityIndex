export default function SearchLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-6">
      <div className="h-8 w-40 bg-zinc-800 rounded" />
      <div className="h-12 w-full bg-zinc-800 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="w-10 h-10 bg-zinc-700 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 bg-zinc-700 rounded" />
              <div className="h-3 w-24 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
