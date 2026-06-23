import { findUp } from 'find-up';
import { config } from 'dotenv';
import { runExpandPeopleJob } from '../jobs/expand-people.job.js';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

console.log('Expanding people registry from Wikidata...');
await runExpandPeopleJob();
