import Link from 'next/link';
import type { ViewPerson } from '../../lib/api';
import { PersonCard } from './PersonCard';

interface Props {
  title: string;
  icon?: string;
  people: ViewPerson[];
  seeAllHref?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function PersonCarousel({ title, icon, people, seeAllHref, size = 'md' }: Props) {
  if (people.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-6 sm:px-8">
        <h2 className="text-lg font-bold text-white">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-sm text-zinc-400 hover:text-white transition-colors">
            See all →
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-6 sm:px-8 pb-2">
        {people.map(person => (
          <PersonCard key={person.wikidataQid} person={person} size={size} />
        ))}
      </div>
    </section>
  );
}
