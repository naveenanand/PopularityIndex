import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '../components/shared/NavBar';
import { MethodologyDisclaimer } from '../components/shared/MethodologyDisclaimer';

export const metadata: Metadata = {
  title: 'Public Attention Index',
  description:
    'PAI assigns transparent public-attention scores to people with Wikipedia biographies. Measures visibility, not talent or moral worth.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 bg-white py-4 px-4">
          <div className="max-w-6xl mx-auto">
            <MethodologyDisclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
