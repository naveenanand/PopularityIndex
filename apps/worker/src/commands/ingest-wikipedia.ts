import { program } from 'commander';
import { findUpSync } from 'find-up';
import { config } from 'dotenv';
import { runWikipediaIngestJob } from '../jobs/wikipedia-ingest.job.js';

const envPath = findUpSync('.env');
if (envPath) config({ path: envPath });

program
  .name('ingest-wikipedia')
  .description('Fetch Wikipedia pageview and metadata for seeded people')
  .option('--person-id <ids...>', 'Ingest specific person IDs (space-separated)')
  .option('--days <n>', 'Days of pageview history to fetch', '90')
  .option('--concurrency <n>', 'Concurrent API requests', '3')
  .parse();

const opts = program.opts<{ personId?: string[]; days: string; concurrency: string }>();

const personIds = opts.personId?.map(Number).filter((n) => !isNaN(n));
const days = parseInt(opts.days, 10);
const concurrency = parseInt(opts.concurrency, 10);

console.log('Starting Wikipedia ingestion...');
console.log(`  Days: ${days}, Concurrency: ${concurrency}`);
if (personIds?.length) console.log(`  Filtering to person IDs: ${personIds.join(', ')}`);

runWikipediaIngestJob({ ...(personIds ? { personIds } : {}), days, concurrency })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
