export default function BrowseLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-8 w-48 bg-zinc-800 rounded" />
        <div className="h-12 w-full max-w-xl bg-zinc-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
            <div className="h-3 w-full bg-zinc-700 rounded" />
            <div className="h-3 w-2/3 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
