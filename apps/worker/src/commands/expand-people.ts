import { findUp } from 'find-up';
import { config } from 'dotenv';
import { runExpandPeopleJob } from '../jobs/expand-people.job.js';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const offset = parseInt(process.argv[2] ?? '0', 10);
console.log(`Expanding people registry from Wikidata (offset=${offset})...`);
await runExpandPeopleJob(offset);
