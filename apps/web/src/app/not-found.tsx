import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Page not found</h2>
      <p className="text-gray-500 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/" className="text-indigo-600 hover:underline text-sm">
        Back to leaderboard
      </Link>
    </div>
  );
}
