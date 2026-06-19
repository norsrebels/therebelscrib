import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { players, assessments, settings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/auth-server";
import { withRetry } from "@/lib/db-retry";

export const getPlayers = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(() => db.select().from(players));
  },
);

export const getPlayerWithAssessment = createServerFn({ method: "GET" })
  .inputValidator((playerId: number) => playerId)
  .handler(async ({ data: playerId }: { data: number }) => {
    const admin = await getAdminUser();
    
    return withRetry(async () => {
      const playerRows = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId));
      if (playerRows.length === 0) return null;

      if (!admin) {
        return {
          player: playerRows[0],
          assessment: null,
        };
      }

      const assessmentRows = await db
        .select()
        .from(assessments)
        .where(eq(assessments.playerId, playerId));
      return {
        player: playerRows[0],
        assessment: assessmentRows[0] || null,
      };
    });
  });

export const createPlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (
      playerData: Omit<
        typeof players.$inferInsert,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => playerData,
  )
  .handler(async ({ data }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    return withRetry(async () => {
      const [newPlayer] = await db.insert(players).values(data).returning();
      return newPlayer;
    });
  });

export const updatePlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: number; updates: Partial<typeof players.$inferInsert> }) =>
      data,
  )
  .handler(async ({ data: { id, updates } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    return withRetry(async () => {
      const [updatedPlayer] = await db
        .update(players)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(players.id, id))
        .returning();
      return updatedPlayer;
    });
  });

export const saveAssessment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      playerId: number;
      assessment: any;
      overallScore: number;
      playerLevel: string;
    }) => data,
  )
  .handler(
    async ({ data: { playerId, assessment, overallScore, playerLevel } }: any) => {
      const admin = await getAdminUser();
      if (!admin) throw new Error("Admin access required");

      return withRetry(async () => {
        await db
          .update(players)
          .set({ overallScore, playerLevel, updatedAt: new Date() })
          .where(eq(players.id, playerId));

        const existing = await db
          .select()
          .from(assessments)
          .where(eq(assessments.playerId, playerId));
        if (existing.length > 0) {
          const [updated] = await db
            .update(assessments)
            .set({ ...assessment, updatedAt: new Date() })
            .where(eq(assessments.playerId, playerId))
            .returning();
          return updated;
        } else {
          const [created] = await db
            .insert(assessments)
            .values({ playerId, ...assessment })
            .returning();
          return created;
        }
      });
    },
  );


export const getPublicSettings = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data: { key } }) => {
    return withRetry(async () => {
      const result = await db.select().from(settings).where(eq(settings.key, key));
      return result[0] || null;
    });
  });

export const getSettings = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data: { key } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");
    return withRetry(async () => {
      const result = await db.select().from(settings).where(eq(settings.key, key));
      return result[0] || null;
    });
  });

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; value: any }) => d)
  .handler(async ({ data: { key, value } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    return withRetry(async () => {
      const existing = await db.select().from(settings).where(eq(settings.key, key));
      if (existing.length > 0) {
        await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
      return { success: true };
    });
  });

export const deletePlayer = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.delete(players).where(eq(players.id, id))
      return { success: true }
    })
  })