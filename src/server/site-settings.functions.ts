import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { siteSettings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry } from "@/lib/db-retry";
import { getAdminUser } from "@/lib/auth-server";

export const getSiteSetting = createServerFn({ method: "GET" })
  .inputValidator((data: { key: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const rows = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, data.key));
      return rows[0] ?? null;
    });
  });

export const getAllSiteSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(async () => {
      const rows = await db.select().from(siteSettings);
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      return map;
    });
  },
);

export const saveSiteSetting = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string; value: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      const existing = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, data.key));
      if (existing.length > 0) {
        await db
          .update(siteSettings)
          .set({ value: data.value, updatedAt: new Date() })
          .where(eq(siteSettings.key, data.key));
      } else {
        await db.insert(siteSettings).values({
          key: data.key,
          value: data.value,
        });
      }
      return { success: true };
    });
  });

export const saveBulkSiteSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { settings: { key: string; value: string }[] }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      for (const s of data.settings) {
        await db
          .insert(siteSettings)
          .values({ key: s.key, value: s.value })
          .onConflictDoUpdate({
            target: siteSettings.key,
            set: { value: s.value, updatedAt: new Date() },
          })
      }
      return { success: true }
    })
  });
