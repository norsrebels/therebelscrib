import re

with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

# Add getSettings and saveSettings
new_funcs = """
export const getSettings = createServerFn("GET", async ({ key }: { key: string }) => {
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
});
"""

if "getSettings" not in content:
    content += "\n" + new_funcs

# we also need to import `settings` from `db/schema`
content = content.replace('players, assessments }', 'players, assessments, settings }')

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)
