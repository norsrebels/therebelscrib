import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { announcements } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { getAdminUser } from "@/lib/auth-server";
import { withRetry } from "@/lib/db-retry";
import sanitize from "sanitize-html";

const sanitizeHtml = (html: string) => {
  return sanitize(html, {
    allowedTags: [
      "b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "img", "div", "iframe", "video"
    ],
    allowedAttributes: {
      img: ["src", "alt", "class", "width", "height"],
      iframe: ["src", "class", "allowfullscreen"],
      div: ["class"],
      video: ["src", "controls", "class"],
    },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com"],
  });
};

export const getAnnouncements = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(() =>
      db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
        .limit(6),
    );
  },
);

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    (
      data: Omit<
        typeof announcements.$inferInsert,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => data,
  )
  .handler(async ({ data }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    if (data.body) {
      data.body = sanitizeHtml(data.body);
    }

    return withRetry(async () => {
      const [newAnnouncement] = await db
        .insert(announcements)
        .values(data)
        .returning();
      return newAnnouncement;
    });
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: number;
      updates: Partial<typeof announcements.$inferInsert>;
    }) => data,
  )
  .handler(async ({ data: { id, updates } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    if (updates.body) {
      updates.body = sanitizeHtml(updates.body);
    }

    return withRetry(async () => {
      const [updatedAnnouncement] = await db
        .update(announcements)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(announcements.id, id))
        .returning();
      return updatedAnnouncement;
    });
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    return withRetry(async () => {
      await db.delete(announcements).where(eq(announcements.id, id));
      return { success: true };
    });
  });

export const togglePinAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; pinned: boolean }) => data)
  .handler(async ({ data: { id, pinned } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    return withRetry(async () => {
      const [updatedAnnouncement] = await db
        .update(announcements)
        .set({ pinned, updatedAt: new Date() })
        .where(eq(announcements.id, id))
        .returning();
      return updatedAnnouncement;
    });
  });
