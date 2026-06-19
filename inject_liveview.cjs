const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');
let liveview = fs.readFileSync('liveview.txt', 'utf8');

content = content.replace("function SettingsTab", liveview + "\n\nfunction SettingsTab");

fs.writeFileSync('src/components/TournamentApp.tsx', content);
