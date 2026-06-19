import re

with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

new_get = """export const getSettings = createServerFn({ method: "GET" })
  .validator((d: { key: string }) => d)
  .handler(async ({ data: { key } }) => {
    const result = await db.select().from(settings).where(eq(settings.key, key));
    return result[0] || null;
  });"""

content = re.sub(r'export const getSettings = createServerFn[^}]+?return result\[0\] \|\| null;\n  \}\);', new_get, content)

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)
