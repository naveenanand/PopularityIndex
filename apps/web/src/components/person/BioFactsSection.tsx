import { getPersonBioFacts } from '../../lib/api';
import type { PersonBioFacts } from '../../lib/api';

interface Props {
  wikidataQid: string;
}

function formatDOB(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function FactRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-base flex-shrink-0 w-5 text-center leading-5 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">{label}</p>
        <div className="text-sm text-zinc-200 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map(item => (
        <span key={item} className="inline-block bg-zinc-800 text-zinc-300 text-xs px-2.5 py-0.5 rounded-full border border-zinc-700">
          {item}
        </span>
      ))}
    </div>
  );
}

function BioFactsContent({ facts }: { facts: PersonBioFacts }) {
  const rows: React.ReactNode[] = [];

  // Date of birth + age
  if (facts.dateOfBirth) {
    const label = facts.age !== null
      ? `${formatDOB(facts.dateOfBirth)} · Age ${facts.age}`
      : formatDOB(facts.dateOfBirth);
    rows.push(<FactRow key="dob" icon="🎂" label="Born" value={label} />);
  }

  // Family
  if (facts.spouses.length > 0) {
    rows.push(
      <FactRow
        key="spouse"
        icon="💍"
        label={facts.spouses.length > 1 ? 'Spouses' : 'Spouse'}
        value={facts.spouses.join(', ')}
      />
    );
  }
  if (facts.childCount > 0) {
    rows.push(
      <FactRow
        key="children"
        icon="👶"
        label="Children"
        value={`${facts.childCount} ${facts.childCount === 1 ? 'child' : 'children'}`}
      />
    );
  }

  // Sport
  if (facts.teams.length > 0) {
    rows.push(<FactRow key="team" icon="🏆" label="Club / Team" value={<Pills items={facts.teams} />} />);
  }
  if (facts.countrySport) {
    rows.push(<FactRow key="cSport" icon="🌍" label="Country Represented" value={facts.countrySport} />);
  }

  // Politics
  if (facts.parties.length > 0) {
    rows.push(<FactRow key="party" icon="🏛️" label="Political Party" value={<Pills items={facts.parties} />} />);
  }

  // Business / tech
  if (facts.employers.length > 0) {
    rows.push(<FactRow key="employer" icon="🏢" label="Employer" value={<Pills items={facts.employers} />} />);
  }
  if (facts.companies.length > 0) {
    rows.push(<FactRow key="companies" icon="💼" label="Companies" value={<Pills items={facts.companies} />} />);
  }

  // Fun fact — prefer notable work, fall back to award
  const funFact = facts.knownFor ?? facts.notableAward;
  if (funFact) {
    const funLabel = facts.knownFor ? 'Known for' : 'Notable award';
    rows.push(<FactRow key="fun" icon="⭐" label={funLabel} value={funFact} />);
  }

  if (rows.length === 0) return null;

  return <>{rows}</>;
}

export async function BioFactsSection({ wikidataQid }: Props) {
  try {
    const raw = await getPersonBioFacts(wikidataQid);
    if (!raw) return null;

    // Normalise: old cache entries may use 'ownerOf' instead of 'companies'
    const r = raw as unknown as Record<string, unknown>;
    const facts: PersonBioFacts = {
      ...raw,
      spouses: (raw.spouses as string[] | undefined) ?? [],
      teams: (raw.teams as string[] | undefined) ?? [],
      parties: (raw.parties as string[] | undefined) ?? [],
      employers: (raw.employers as string[] | undefined) ?? [],
      companies: (raw.companies as string[] | undefined) ?? (r['ownerOf'] as string[] | undefined) ?? [],
    };

    const hasData = facts.dateOfBirth ||
      facts.spouses.length > 0 ||
      facts.childCount > 0 ||
      facts.teams.length > 0 ||
      facts.countrySport ||
      facts.parties.length > 0 ||
      facts.employers.length > 0 ||
      facts.companies.length > 0 ||
      facts.knownFor ||
      facts.notableAward;

    if (!hasData) return null;

    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
        <h2 className="font-bold text-white text-sm mb-1">About</h2>
        <BioFactsContent facts={facts} />
      </div>
    );
  } catch (err) {
    console.error('[BioFactsSection] render error for', wikidataQid, err);
    return null;
  }
}

// Compact version for compare page (no card wrapper)
export async function BioFactsCompact({ wikidataQid }: Props) {
  const raw = await getPersonBioFacts(wikidataQid);
  if (!raw) return null;

  const r = raw as unknown as Record<string, unknown>;
  const facts: PersonBioFacts = {
    ...raw,
    spouses: (raw.spouses as string[] | undefined) ?? [],
    teams: (raw.teams as string[] | undefined) ?? [],
    parties: (raw.parties as string[] | undefined) ?? [],
    employers: (raw.employers as string[] | undefined) ?? [],
    companies: (raw.companies as string[] | undefined) ?? (r['ownerOf'] as string[] | undefined) ?? [],
  };

  const items: string[] = [];
  if (facts.dateOfBirth && facts.age !== null) items.push(`Age ${facts.age}`);
  if (facts.spouses.length > 0) items.push(facts.spouses[0]!);
  if (facts.childCount > 0) items.push(`${facts.childCount} kids`);
  if (facts.parties.length > 0) items.push(facts.parties[0]!);
  if (facts.teams.length > 0) items.push(facts.teams[0]!);
  if (facts.employers.length > 0) items.push(facts.employers[0]!);
  if (facts.companies.length > 0) items.push(facts.companies.slice(0, 2).join(', '));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {items.map((item, i) => (
        <span key={i} className="inline-block bg-zinc-800 text-zinc-400 text-[11px] px-2 py-0.5 rounded-full border border-zinc-700/60">
          {item}
        </span>
      ))}
    </div>
  );
}
