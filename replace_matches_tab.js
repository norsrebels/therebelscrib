const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

// I will extract MatchesTab and put my own logic that maps pool matches then playoff games.
// Actually, it's easier to just create a new function UnifiedMatchesTab, replace ScheduleTab usage with it,
// and remove ScheduleTab and PlayoffsTab.
