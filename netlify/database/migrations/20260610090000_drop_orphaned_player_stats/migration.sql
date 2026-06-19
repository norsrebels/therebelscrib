-- Purge orphaned player statistics.
--
-- player_stats.team_id holds the schedule (tournament) id the row was recorded under, but
-- there is no foreign key back to the tournaments registry. Deleting a schedule removed its
-- tournaments row while leaving every player_stats row in place, so statistics for deleted
-- schedules were counted forever in the leaderboard's combined view despite the schedule no
-- longer being selectable.
--
-- This removes statistics whose owning schedule is no longer present in the tournaments
-- registry. The 'vis-hub' source (stats migrated from the VIS volleyball tables) is not a
-- tournaments-registered schedule and is explicitly preserved.
DELETE FROM "player_stats" ps
WHERE ps."team_id" <> 'vis-hub'
  AND NOT EXISTS (
    SELECT 1 FROM "tournaments" t WHERE t."external_id" = ps."team_id"
  );
