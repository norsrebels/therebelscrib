const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

// I will insert MatchesTab somewhere. Let's find ScheduleTab and replace it.
// First, let's just append it before SettingsTab, then we can delete ScheduleTab and PlayoffsTab.
