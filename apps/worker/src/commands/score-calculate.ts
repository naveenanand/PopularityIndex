import { findUpSync } from 'find-up';
import { config } from 'dotenv';
import { runScoreCalculateJob } from '../jobs/score-calculate.job.js';

const envPath = findUpSync('.env');
if (envPath) config({ path: envPath });

console.log('Starting score calculation...');

runScoreCalculateJob()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Score calculation failed:', err);
    process.exit(1);
  });
