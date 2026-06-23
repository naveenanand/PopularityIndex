import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology — Public Attention Index',
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 prose prose-gray">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How PAI Scores Work</h1>
        <p className="text-gray-600 mt-2 text-sm">
          PAI measures <strong>public attention and visibility</strong> — how much the world is
          currently watching, reading, and talking about a person. It does not measure talent,
          achievement, or moral worth.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <strong>Important:</strong> Scores reflect real-time data signals and may fluctuate daily
        based on news cycles, viral moments, and Wikipedia edit activity. A high score means more
        people are paying attention right now — nothing more.
      </div>

      {/* Two scores */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Two Scores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="font-semibold text-indigo-700">Popularity Score</div>
            <p className="text-sm text-gray-600 mt-1">
              Overall public mindshare. Combines search interest, Wikipedia traffic, news coverage,
              social reach, conversation volume, and Wikipedia presence across languages.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="font-semibold text-amber-700">Heat Score</div>
            <p className="text-sm text-gray-600 mt-1">
              Momentum right now. Measures spikes in Wikipedia pageviews, search interest, news
              velocity, and social conversation compared to recent baselines.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Sentiment is tracked separately and shown on person profiles. It is never used to calculate
          Popularity or Heat.
        </p>
      </section>

      {/* Popularity components */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Popularity Components</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Component</th>
                <th className="text-right p-3">Weight</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { component: 'Search interest', weight: '15%', source: 'Google Trends proxy', status: 'Mock', color: 'text-yellow-600' },
                { component: 'Wikipedia attention', weight: '15%', source: 'Wikimedia Pageviews API', status: 'Live', color: 'text-green-600' },
                { component: 'News / media coverage', weight: '25%', source: 'News API proxy', status: 'Mock', color: 'text-yellow-600' },
                { component: 'Social reach', weight: '15%', source: 'Social data proxy', status: 'Mock', color: 'text-yellow-600' },
                { component: 'Conversation volume', weight: '15%', source: 'Conversation proxy', status: 'Mock', color: 'text-yellow-600' },
                { component: 'Enduring prominence', weight: '15%', source: 'Wikidata (sitelinks)', status: 'Live', color: 'text-green-600' },
              ].map((row) => (
                <tr key={row.component} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">{row.component}</td>
                  <td className="p-3 text-right font-mono text-gray-600">{row.weight}</td>
                  <td className="p-3 text-gray-500 text-xs">{row.source}</td>
                  <td className={`p-3 text-xs font-medium ${row.color}`}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Heat components */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Heat Components</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Component</th>
                <th className="text-right p-3">Weight</th>
                <th className="text-left p-3">Calculation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { component: 'Search spike', weight: '30%', calc: 'log₁₀(7d avg / 90d avg) / log₁₀(50) × 100' },
                { component: 'Pageview spike', weight: '25%', calc: 'log₁₀(7d avg / 90d avg) / log₁₀(50) × 100' },
                { component: 'News velocity', weight: '25%', calc: 'Articles this week vs. baseline' },
                { component: 'Social velocity', weight: '20%', calc: 'Conversation velocity ratio' },
              ].map((row) => (
                <tr key={row.component} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">{row.component}</td>
                  <td className="p-3 text-right font-mono text-gray-600">{row.weight}</td>
                  <td className="p-3 text-gray-500 text-xs font-mono">{row.calc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Missing data policy */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Missing Data Policy</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
          <p>
            When a signal is unavailable, it is <strong>excluded from the denominator</strong> of
            the weighted average — it never pulls the score down. A person with 3 live signals
            scores as if those 3 signals are the full picture, rescaled to 100%.
          </p>
          <p>
            Coverage score shows what fraction of signals were available. Scores with low coverage
            should be interpreted with caution.
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Coverage label</th>
                <th className="text-left p-3">Threshold</th>
                <th className="text-left p-3">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr><td className="p-3 text-green-700 font-medium">High coverage</td><td className="p-3 text-gray-500">≥ 70% signals</td><td className="p-3 text-gray-500 text-xs">Score is well-supported by available data</td></tr>
              <tr><td className="p-3 text-blue-700 font-medium">Partial coverage</td><td className="p-3 text-gray-500">40–69% signals</td><td className="p-3 text-gray-500 text-xs">Score is directionally correct but some signals are missing</td></tr>
              <tr><td className="p-3 text-gray-500 font-medium">Insufficient data</td><td className="p-3 text-gray-500">&lt; 40% signals</td><td className="p-3 text-gray-500 text-xs">Too few signals to form a reliable score</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Score model version */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">Score Model</h2>
        <p className="text-sm text-gray-600 mt-2">
          All scores are tagged with a model version (currently <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">v1</code>). When the scoring formula changes, scores from different versions will not be compared to each other.
        </p>
      </section>
    </div>
  );
}
