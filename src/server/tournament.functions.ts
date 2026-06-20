import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { tournaments, playerStats } from "../../db/schema.js";
import { eq, sql, inArray } from "drizzle-orm";
import { withRetry } from "@/lib/db-retry";
import { getAdminUser } from "@/lib/auth-server";

export const getTournaments = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(async () => {
      const rows = await db
        .select()
        .from(tournaments)
        .orderBy(tournaments.createdAt);

      // Get match counts per tournament from player_stats
      // matchesPlayed = distinct matchIds that have at least one stat entry
      // matchesTotal = stored in tournament state JSON (not in DB), so we approximate
      // by counting distinct matchIds linked to each tournament via teamId
      const tournamentIds = rows.map(r => r.externalId);
      let matchCounts: Record<string, number> = {};

      if (tournamentIds.length > 0) {
        const countRows = await db.execute(sql`
          SELECT team_id, COUNT(DISTINCT match_id) as match_count
          FROM player_stats
          WHERE team_id = ANY(${sql.raw("ARRAY['" + tournamentIds.join("','") + "']")})
          GROUP BY team_id
        `);
        for (const row of countRows.rows as any[]) {
          matchCounts[row.team_id] = Number(row.match_count);
        }
      }

      return rows.map((r) => ({
        id: r.externalId,
        name: r.name,
        archived: r.archived,
        createdAt: r.createdAt?.getTime() ?? Date.now(),
        matchesPlayed: matchCounts[r.externalId] ?? 0,
        matchesTotal: 0, // populated client-side from tournament state
      }));
    });
  },
);

export const createTournament = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      const [row] = await db
        .insert(tournaments)
        .values({
          externalId: data.id,
          name: data.name,
        })
        .returning();
      return {
        id: row.externalId,
        name: row.name,
        archived: row.archived,
        createdAt: row.createdAt?.getTime() ?? Date.now(),
      };
    });
  });

export const toggleArchiveTournament = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; archived: boolean }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      await db
        .update(tournaments)
        .set({ archived: data.archived, updatedAt: new Date() })
        .where(eq(tournaments.externalId, data.id));
      return { success: true };
    });
  });

export const deleteTournament = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser()
    if (!user) throw new Error('Unauthorized')
    return withRetry(async () => {
      // Remove the schedule's recorded statistics alongside the schedule itself.
      // player_stats has no foreign key to tournaments, so without this the rows would be
      // orphaned — invisible (no schedule to open) yet still summed into the combined
      // leaderboard totals.
      await db.delete(playerStats)
        .where(eq(playerStats.teamId, data.id))
      await db.delete(tournaments)
        .where(eq(tournaments.externalId, data.id))
      return { success: true }
    })
  })
