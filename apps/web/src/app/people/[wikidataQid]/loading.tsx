export default function PersonLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse space-y-8">
      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 bg-zinc-800 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-8 w-56 bg-zinc-800 rounded" />
          <div className="h-4 w-32 bg-zinc-700 rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-zinc-800 rounded-full" />
            <div className="h-6 w-20 bg-zinc-800 rounded-full" />
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-zinc-700 rounded" />
            <div className="h-8 w-16 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-48" />

      {/* Signal breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 border-b border-zinc-800">
            <div className="h-3 w-36 bg-zinc-800 rounded flex-1" />
            <div className="h-3 w-12 bg-zinc-700 rounded" />
            <div className="h-5 w-10 bg-zinc-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
