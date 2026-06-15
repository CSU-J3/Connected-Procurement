import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Masthead } from '@/components/Masthead';
import { Footer } from '@/components/Footer';
import {
  getRelationships,
  getEntities,
  getPersons,
  getFilings,
  getSyncedAt,
  getNexusLinks,
} from '@/lib/data';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Connected Procurement',
  description:
    'Registry of federal financial-disclosure entities tied to named family members of the current administration. Methodology-first, primary-source-traceable.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [filings, entities, persons, relationships, synced, nexusLinks] = await Promise.all([
    getFilings(),
    getEntities(),
    getPersons(),
    getRelationships(),
    getSyncedAt(),
    getNexusLinks(),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Masthead
          filings={filings.length}
          entities={entities.length}
          persons={persons.length}
          edges={relationships.length}
          nexuses={nexusLinks.length}
          nexusCounted={nexusLinks.filter((n) => n.counting_status === 'counted').length}
          phase={
            filings.some((f) => f.ingestion_timestamp)
              ? 'live collection'
              : 'pre-collection'
          }
        />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <Footer syncedAt={synced.synced_at} />
      </body>
    </html>
  );
}
