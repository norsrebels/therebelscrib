const fs = require('fs');

let content = fs.readFileSync('src/lib/tournament.ts', 'utf8');

content = content.replace(
  "  maxScore: number | null\n}",
  "  maxScore: number | null\n  facebookUrl?: string\n  instagramUrl?: string\n  contactUrl?: string\n}"
);

fs.writeFileSync('src/lib/tournament.ts', content);
