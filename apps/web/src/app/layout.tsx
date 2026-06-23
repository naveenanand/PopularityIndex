import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '../components/shared/NavBar';

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
        <footer className="border-t border-zinc-800 py-6 px-6 mt-16">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-500">Public Attention Index</span>
            <span>Scores based on Wikipedia pageviews, GDELT news coverage, and Wikidata signals. Not a judgment of talent or worth.</span>
            <a href="/methodology" className="text-zinc-500 hover:text-zinc-300 transition-colors">Methodology →</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
