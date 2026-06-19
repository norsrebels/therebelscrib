import re

with open("src/components/TournamentApp.tsx", "r") as f:
    content = f.read()

# We need to remove from "function PlayerDatabaseTab({" to the end of that function.
content = re.sub(
    r'function PlayerDatabaseTab\(\{[\s\S]*?\n\}\n\n',
    r'',
    content
)

with open("src/components/TournamentApp.tsx", "w") as f:
    f.write(content)
