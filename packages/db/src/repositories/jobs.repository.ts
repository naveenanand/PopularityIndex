import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { jobRuns } from '../schema/index.js';

export function makeJobsRepository(db: Db) {
  return {
    async startJobRun(jobType: string, metadata?: Record<string, unknown>) {
      const [job] = await db
        .insert(jobRuns)
        .values({
          jobType,
          startedAt: new Date(),
          status: 'running',
          recordsProcessed: 0,
          metadataJson: metadata,
        })
        .returning();
      if (!job) throw new Error('Failed to create job run');
      return job;
    },

    async completeJobRun(id: number, recordsProcessed: number) {
      await db
        .update(jobRuns)
        .set({ status: 'completed', completedAt: new Date(), recordsProcessed })
        .where(eq(jobRuns.id, id));
    },

    async failJobRun(id: number, errorMessage: string) {
      await db
        .update(jobRuns)
        .set({ status: 'failed', completedAt: new Date(), errorMessage })
        .where(eq(jobRuns.id, id));
    },
  };
}
