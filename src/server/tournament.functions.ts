import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { tournaments, playerStats } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry } from "@/lib/db-retry";
import { getAdminUser } from "@/lib/auth-server";

export const getTournaments = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(async () => {
      const rows = await db
        .select()
        .from(tournaments)
        .orderBy(tournaments.createdAt);
      return rows.map((r) => ({
        id: r.externalId,
        name: r.name,
        archived: r.archived,
        createdAt: r.createdAt?.getTime() ?? Date.now(),
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
