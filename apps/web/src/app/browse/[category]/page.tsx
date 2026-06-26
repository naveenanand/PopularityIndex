export const revalidate = 300;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPeopleByCategory } from '../../../lib/api';
import { formatScore } from '../../../lib/formatters';

interface PageProps {
  params: Promise<{ category: string }>;
}

function toLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const label = toLabel(category);
  return {
    title: `${label} — Browse by Category | Popularity Index`,
    description: `Public figures ranked by popularity score in the ${label} category.`,
  };
}

export default async function CategoryBrowsePage({ params }: PageProps) {
  const { category } = await params;
  const label = toLabel(category);

  const people = await getPeopleByCategory(category);
  if (people.length === 0) return notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
        <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/browse" className="hover:text-zinc-400 transition-colors">Browse</Link>
        <span>/</span>
        <span className="text-zinc-500 capitalize">{label}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white capitalize">{label}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {people.length} people ranked by popularity score
        </p>
      </div>

      {/* Ranked list */}
      <div className="space-y-2">
        {people.map((person) => (
          <Link
            key={person.wikidataQid}
            href={`/people/${person.wikidataQid}`}
            className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group"
          >
            <span className="text-2xl font-black text-zinc-700 w-10 flex-shrink-0 leading-none tabular-nums text-right">
              {person.rank}
            </span>

            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.displayName}
                className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0 border border-zinc-700"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm flex-shrink-0">
                {person.displayName[0]}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-sm group-hover:text-zinc-100 truncate">
                {person.displayName}
              </p>
              {person.occupationSummary && (
                <p className="text-zinc-600 text-xs capitalize truncate">
                  {person.occupationSummary.replace(/_/g, ' ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-right">
                <p className="font-bold text-sm text-amber-400">{formatScore(person.popularityScore)}</p>
                <p className="text-zinc-600 text-xs">Popularity</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-orange-400">{formatScore(person.heatScore)}</p>
                <p className="text-zinc-600 text-xs">Heat</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Back */}
      <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        ← Back to all categories
      </Link>
    </div>
  );
}
