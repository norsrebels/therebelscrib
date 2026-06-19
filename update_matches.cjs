const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

// Replace tabs list
content = content.replace(
  "(['teams', 'schedule', 'leaderboard', 'playoffs', 'settings'] as const)",
  "(['teams', 'matches', 'leaderboard', 'settings'] as const)"
);

content = content.replace(
  "{tab === 'schedule' && <ScheduleTab state={state} setState={setState} />}",
  "{tab === 'matches' && <MatchesTab state={state} setState={setState} />}"
);

content = content.replace(
  "{tab === 'playoffs' && <PlayoffsTab state={state} setState={setState} />}\n",
  ""
);

fs.writeFileSync('src/components/TournamentApp.tsx', content);
