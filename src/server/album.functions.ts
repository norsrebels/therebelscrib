import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { albums, albumImages } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry } from "@/lib/db-retry";
import { getAdminUser } from "@/lib/auth-server";

export const getAlbums = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(async () => {
      const rows = await db.select().from(albums).orderBy(albums.createdAt);
      return rows;
    });
  },
);

export const getAlbumImages = createServerFn({ method: "GET" })
  .inputValidator((data: { albumId: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const rows = await db
        .select()
        .from(albumImages)
        .where(eq(albumImages.albumId, data.albumId))
        .orderBy(albumImages.createdAt);
      return rows;
    });
  });

export const createAlbum = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; coverImageUrl?: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      const [row] = await db
        .insert(albums)
        .values({
          name: data.name,
          coverImageUrl: data.coverImageUrl || null,
        })
        .returning();
      return row;
    });
  });

export const deleteAlbum = createServerFn({ method: "POST" })
  .inputValidator((data: { albumId: number }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      await db.delete(albums).where(eq(albums.id, data.albumId));
      return { success: true };
    });
  });

export const addImageToAlbum = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      albumId: number;
      imageId: string;
      imageUrl: string;
      alt?: string;
      caption?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      const [row] = await db
        .insert(albumImages)
        .values({
          albumId: data.albumId,
          imageId: data.imageId,
          imageUrl: data.imageUrl,
          alt: data.alt || "",
          caption: data.caption || "",
        })
        .returning();
      return row;
    });
  });

export const removeImageFromAlbum = createServerFn({ method: "POST" })
  .inputValidator((data: { imageRecordId: number }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      await db
        .delete(albumImages)
        .where(eq(albumImages.id, data.imageRecordId));
      return { success: true };
    });
  });

export const updateAlbum = createServerFn({ method: "POST" })
  .inputValidator((data: { albumId: number; coverImageUrl: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAdminUser();
    if (!user) throw new Error("Unauthorized");
    return withRetry(async () => {
      const [row] = await db
        .update(albums)
        .set({ coverImageUrl: data.coverImageUrl, updatedAt: new Date() })
        .where(eq(albums.id, data.albumId))
        .returning();
      return row;
    });
  });
