import re

with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

# Replace the wrong syntax
old_code = """export const getSettings = createServerFn("GET", async ({ key }: { key: string }) => {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Admin access required");
  const result = await db.select().from(settings).where(eq(settings.key, key));
  return result[0] || null;
});

export const saveSettings = createServerFn("POST", async ({ key, value }: { key: string, value: any }) => {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Admin access required");
  
  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length > 0) {
    await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
  return { success: true };
});"""

new_code = """export const getSettings = createServerFn({ method: "GET" })
  .validator((d: { key: string }) => d)
  .handler(async ({ data: { key } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");
    const result = await db.select().from(settings).where(eq(settings.key, key));
    return result[0] || null;
  });

export const saveSettings = createServerFn({ method: "POST" })
  .validator((d: { key: string; value: any }) => d)
  .handler(async ({ data: { key, value } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");
    
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length > 0) {
      await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
    return { success: true };
  });"""

content = content.replace(old_code, new_code)

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)
