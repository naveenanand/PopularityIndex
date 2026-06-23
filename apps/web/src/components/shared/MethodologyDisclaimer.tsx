import Link from 'next/link';

export function MethodologyDisclaimer() {
  return (
    <div className="text-xs text-gray-500 border-l-4 border-gray-200 pl-3 py-1">
      PAI measures public attention and visibility only. It does not reflect talent, moral worth, or
      personal value.{' '}
      <Link href="/methodology" className="underline hover:text-gray-700">
        Learn how scores work →
      </Link>
    </div>
  );
}
