import { eq, ilike, or, desc, asc } from 'drizzle-orm';
import type { Db } from '../client.js';
import { people, personAliases, wikipediaPages } from '../schema/index.js';

export interface UpsertPersonData {
  wikidataQid: string;
  displayName: string;
  normalizedName: string;
  dateOfBirth?: string;
  occupationSummary?: string;
  photoUrl?: string;
  wikipediaPageTitle?: string;
}

export function makePeopleRepository(db: Db) {
  return {
    async findAll(limit = 100, offset = 0) {
      return db.select().from(people).orderBy(asc(people.displayName)).limit(limit).offset(offset);
    },

    async findByWikidataQid(qid: string) {
      const rows = await db
        .select()
        .from(people)
        .where(eq(people.wikidataQid, qid))
        .limit(1);
      return rows[0] ?? null;
    },

    async findByNormalizedName(query: string) {
      const normalized = query.toLowerCase().trim();
      return db
        .select({ person: people })
        .from(people)
        .leftJoin(personAliases, eq(personAliases.personId, people.id))
        .where(
          or(
            ilike(people.normalizedName, `%${normalized}%`),
            ilike(personAliases.alias, `%${normalized}%`),
          ),
        )
        .limit(20);
    },

    async upsertFromWikidata(data: UpsertPersonData) {
      const [person] = await db
        .insert(people)
        .values({
          wikidataQid: data.wikidataQid,
          displayName: data.displayName,
          normalizedName: data.normalizedName,
          dateOfBirth: data.dateOfBirth,
          occupationSummary: data.occupationSummary,
          ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: people.wikidataQid,
          set: {
            displayName: data.displayName,
            normalizedName: data.normalizedName,
            dateOfBirth: data.dateOfBirth,
            occupationSummary: data.occupationSummary,
            ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!person) throw new Error(`Failed to upsert person ${data.wikidataQid}`);

      if (data.wikipediaPageTitle) {
        await db
          .insert(wikipediaPages)
          .values({
            personId: person.id,
            languageCode: 'en',
            pageTitle: data.wikipediaPageTitle,
            isPrimary: true,
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }

      return person;
    },

    async getAllWithWikipediaPages() {
      return db
        .select({
          person: people,
          wikiPage: wikipediaPages,
        })
        .from(people)
        .leftJoin(
          wikipediaPages,
          eq(wikipediaPages.personId, people.id),
        )
        .where(eq(wikipediaPages.isPrimary, true));
    },
  };
}
