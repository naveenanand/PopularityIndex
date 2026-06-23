import Link from 'next/link';

export function NavBar() {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-gray-900 text-lg tracking-tight">
          Public Attention Index
        </Link>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/search" className="hover:text-gray-900">
            Search
          </Link>
          <Link href="/methodology" className="hover:text-gray-900">
            Methodology
          </Link>
        </div>
      </div>
    </nav>
  );
}
