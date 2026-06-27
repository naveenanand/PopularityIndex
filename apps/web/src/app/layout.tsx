import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '../components/shared/NavBar';
import { NewsletterSignup } from '../components/shared/NewsletterSignup';
import { BugReportButton } from '../components/shared/BugReportButton';

export const metadata: Metadata = {
  title: 'Public Attention Index',
  description:
    'PAI assigns transparent public-attention scores to people with Wikipedia biographies. Measures visibility, not talent or moral worth.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-zinc-100 antialiased min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1">{children}</main>

        {/* Newsletter + footer */}
        <footer className="border-t border-zinc-800 mt-16">
          {/* Newsletter strip */}
          <div className="border-b border-zinc-800/60 py-8 px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-zinc-200 text-sm">Weekly trending digest</p>
                <p className="text-xs text-zinc-500 mt-0.5">Who spiked this week and why — straight to your inbox.</p>
              </div>
              <NewsletterSignup />
            </div>
          </div>

          {/* Bottom bar */}
          <div className="py-5 px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-500">Public Attention Index</span>
              <span>Scores based on Wikipedia pageviews, GDELT news coverage, and Wikidata signals. Not a judgment of talent or worth.</span>
              <a href="/methodology" className="text-zinc-500 hover:text-zinc-300 transition-colors">Methodology →</a>
            </div>
          </div>
        </footer>

        {/* Floating bug report button */}
        <BugReportButton />
      </body>
    </html>
  );
}
