export default function HomeLoading() {
  return (
    <div className="animate-pulse space-y-0 pb-16">
      {/* Hero skeleton */}
      <div className="relative w-full h-[60vh] min-h-[400px] max-h-[700px] bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30" />
        <div className="absolute inset-0 flex flex-col justify-end pb-12 px-6 sm:px-10 max-w-2xl space-y-4">
          <div className="h-3 w-32 bg-zinc-700 rounded" />
          <div className="h-14 w-72 bg-zinc-700 rounded" />
          <div className="flex gap-3">
            <div className="h-7 w-24 bg-zinc-700 rounded-full" />
            <div className="h-7 w-24 bg-zinc-700 rounded-full" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-zinc-700 rounded-lg" />
            <div className="h-10 w-32 bg-zinc-800 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="sticky top-16 z-40 bg-[#0a0a0a]/95 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-2">
          {[80, 60, 80, 70, 80].map((w, i) => (
            <div key={i} className={`h-7 bg-zinc-800 rounded-full`} style={{ width: w }} />
          ))}
        </div>
      </div>

      <div className="space-y-10 pt-10">
        {/* Carousel skeleton */}
        <section className="space-y-3">
          <div className="px-6 sm:px-8">
            <div className="h-5 w-48 bg-zinc-800 rounded" />
          </div>
          <div className="flex gap-3 overflow-hidden px-6 sm:px-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-40 h-56 bg-zinc-800 rounded-xl" />
            ))}
          </div>
        </section>

        {/* Grid skeleton */}
        <section className="px-6 sm:px-8 space-y-4">
          <div className="h-5 w-36 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="w-10 h-10 bg-zinc-700 rounded" />
                <div className="w-12 h-12 bg-zinc-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-zinc-700 rounded" />
                  <div className="h-3 w-20 bg-zinc-800 rounded" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3.5 w-10 bg-zinc-700 rounded ml-auto" />
                  <div className="h-3 w-14 bg-zinc-800 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
