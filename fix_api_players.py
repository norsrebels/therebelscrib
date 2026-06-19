import re

with open("src/routes/api.players.ts", "r") as f:
    content = f.read()

content = content.replace("import { ilike, or } from 'drizzle-orm'", "import { ilike, or, eq } from 'drizzle-orm'")
content = content.replace("ilike(players.id, parseInt(body.id) as any)", "eq(players.id, parseInt(body.id))")

with open("src/routes/api.players.ts", "w") as f:
    f.write(content)
