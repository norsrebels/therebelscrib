-- 20260623000004_retag_orphaned_player_stats
-- Rescue player_stats rows mis-tagged before the client + self-heal fixes.
--
-- player_stats.team_id holds the tournament (schedule) id a row belongs to. Stats
-- recorded offline before the fix were stamped with a within-match team id instead,
-- so they fall outside the tournament leaderboard filter AND match the destructive
-- criteria in 20260610090000_drop_orphaned_player_stats (which deletes any team_id
-- that is neither 'vis-hub' nor a valid tournaments.external_id).
--
-- This re-tags each orphaned row to the correct tournament by deriving it from a
-- TRUSTED SIBLING in the SAME match: a row already tagged with a valid tournament id.
-- Matches with no valid sibling (fully offline) are left untouched — those require the
-- blob-based remediation and are handled separately.
--
-- Safety:
--   * 'vis-hub' rows are never touched.
--   * Correctly-tagged rows are never touched.
--   * Only rows whose team_id is neither 'vis-hub' nor a valid tournament id change.
--   * Idempotent: a second run finds nothing left to fix.

WITH good AS (
  -- One trusted tournament id per match: the most common valid tag,
  -- deterministic tiebreak by team_id.
  SELECT match_id, team_id
  FROM (
    SELECT
      ps.match_id,
      ps.team_id,
      ROW_NUMBER() OVER (
        PARTITION BY ps.match_id
        ORDER BY COUNT(*) DESC, ps.team_id
      ) AS rn
    FROM "player_stats" ps
    WHERE ps.team_id <> 'vis-hub'
      AND EXISTS (SELECT 1 FROM "tournaments" t WHERE t.external_id = ps.team_id)
    GROUP BY ps.match_id, ps.team_id
  ) ranked
  WHERE rn = 1
)
UPDATE "player_stats" p
SET team_id = good.team_id
FROM good
WHERE p.match_id = good.match_id
  AND p.team_id <> 'vis-hub'
  AND NOT EXISTS (SELECT 1 FROM "tournaments" t WHERE t.external_id = p.team_id);
