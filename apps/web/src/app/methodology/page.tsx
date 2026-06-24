import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology — Public Attention Index',
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">How PAI Scores Work</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          PAI measures <strong className="text-zinc-200">public attention and visibility</strong> — how much the world is
          currently watching, reading, and talking about a person. It does not measure talent,
          achievement, or moral worth.
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
        <strong className="text-amber-200">Important:</strong> Scores reflect real-time data signals and may fluctuate daily
        based on news cycles, viral moments, and Wikipedia edit activity. A high score means more
        people are paying attention right now — nothing more.
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Two Scores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="font-semibold text-amber-400 mb-1">Popularity Score</div>
            <p className="text-sm text-zinc-400">
              Overall public mindshare. Combines search interest, Wikipedia traffic, news coverage,
              social reach, conversation volume, and Wikipedia presence across languages.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="font-semibold text-orange-400 mb-1">Heat Score</div>
            <p className="text-sm text-zinc-400">
              Momentum right now. Measures spikes in Wikipedia pageviews, search interest, news
              velocity, and social conversation compared to recent baselines.
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-600">
          Sentiment is tracked separately and shown on person profiles. It is never used to calculate
          Popularity or Heat.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Popularity Components</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Component</th>
                <th className="text-right p-3">Weight</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {[
                { component: 'Search interest', weight: '15%', source: 'Google Trends proxy', status: 'Mock', color: 'text-amber-400' },
                { component: 'Wikipedia attention', weight: '15%', source: 'Wikimedia Pageviews API', status: 'Live', color: 'text-emerald-400' },
                { component: 'News / media coverage', weight: '25%', source: 'News API proxy', status: 'Mock', color: 'text-amber-400' },
                { component: 'Social reach', weight: '15%', source: 'Social data proxy', status: 'Mock', color: 'text-amber-400' },
                { component: 'Conversation volume', weight: '15%', source: 'Conversation proxy', status: 'Mock', color: 'text-amber-400' },
                { component: 'Enduring prominence', weight: '15%', source: 'Wikidata (sitelinks)', status: 'Live', color: 'text-emerald-400' },
              ].map((row) => (
                <tr key={row.component} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="p-3 font-medium text-zinc-200">{row.component}</td>
                  <td className="p-3 text-right font-mono text-zinc-400">{row.weight}</td>
                  <td className="p-3 text-zinc-500 text-xs">{row.source}</td>
                  <td className={`p-3 text-xs font-semibold ${row.color}`}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Heat Components</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Component</th>
                <th className="text-right p-3">Weight</th>
                <th className="text-left p-3">Calculation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {[
                { component: 'Search spike', weight: '30%', calc: 'log₁₀(7d avg / 90d avg) / log₁₀(50) × 100' },
                { component: 'Pageview spike', weight: '25%', calc: 'log₁₀(7d avg / 90d avg) / log₁₀(50) × 100' },
                { component: 'News velocity', weight: '25%', calc: 'Articles this week vs. baseline' },
                { component: 'Social velocity', weight: '20%', calc: 'Conversation velocity ratio' },
              ].map((row) => (
                <tr key={row.component} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="p-3 font-medium text-zinc-200">{row.component}</td>
                  <td className="p-3 text-right font-mono text-zinc-400">{row.weight}</td>
                  <td className="p-3 text-zinc-500 text-xs font-mono">{row.calc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Missing Data Policy</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400 space-y-2">
          <p>
            When a signal is unavailable, it is <strong className="text-zinc-200">excluded from the denominator</strong> of
            the weighted average — it never pulls the score down. A person with 3 live signals
            scores as if those 3 signals are the full picture, rescaled to 100%.
          </p>
          <p>
            Coverage score shows what fraction of signals were available. Scores with low coverage
            should be interpreted with caution.
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Coverage label</th>
                <th className="text-left p-3">Threshold</th>
                <th className="text-left p-3">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <tr className="hover:bg-zinc-800/50 transition-colors">
                <td className="p-3 text-emerald-400 font-medium">High coverage</td>
                <td className="p-3 text-zinc-500">≥ 70% signals</td>
                <td className="p-3 text-zinc-500 text-xs">Score is well-supported by available data</td>
              </tr>
              <tr className="hover:bg-zinc-800/50 transition-colors">
                <td className="p-3 text-amber-400 font-medium">Partial coverage</td>
                <td className="p-3 text-zinc-500">40–69% signals</td>
                <td className="p-3 text-zinc-500 text-xs">Score is directionally correct but some signals are missing</td>
              </tr>
              <tr className="hover:bg-zinc-800/50 transition-colors">
                <td className="p-3 text-zinc-500 font-medium">Insufficient data</td>
                <td className="p-3 text-zinc-500">&lt; 40% signals</td>
                <td className="p-3 text-zinc-500 text-xs">Too few signals to form a reliable score</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Score Model</h2>
        <p className="text-sm text-zinc-400 mt-2">
          All scores are tagged with a model version (currently{' '}
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-300">v1</code>
          ). When the scoring formula changes, scores from different versions will not be compared to each other.
        </p>
      </section>
    </div>
  );
}
