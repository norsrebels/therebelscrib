import re

with open("src/components/TournamentApp.tsx", "r") as f:
    content = f.read()

# Remove 'player db' from useState
content = re.sub(
    r'"teams" \| "matches" \| "leaderboard" \| "player db" \| "settings"',
    r'"teams" | "matches" | "leaderboard" | "settings"',
    content
)

# Remove 'player db' from tabs array
content = re.sub(
    r'"player db",\s*',
    r'',
    content
)

# Remove the tab rendering
content = re.sub(
    r'\{\s*tab === "player db" && \([\s\S]*?setState={setState}\s*\/>\s*\)\s*\}\s*',
    r'',
    content
)

with open("src/components/TournamentApp.tsx", "w") as f:
    f.write(content)
