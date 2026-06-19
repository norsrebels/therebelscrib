-- Add the three stat columns that exist in vis_set_stats but were missing from player_stats
ALTER TABLE "player_stats"
  ADD COLUMN IF NOT EXISTS "block_rebound" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "dig_attempt" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "receive_attempt" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill existing vis_set_stats rows into player_stats (single source of truth).
-- Only rows whose roster entry is linked to a global player (global_player_id) are migrated;
-- unlinked players have no players.id to reference and are skipped. vis_set_stats is left intact.
INSERT INTO player_stats (
  match_id, player_id, team_id, set_number,
  attack_kill, attack_error, attack_attempt,
  block_solo, block_error, block_rebound,
  serve_ace, serve_error, serve_attempt,
  dig, dig_error, dig_attempt,
  set_assist, set_ball_handling_error, set_attempt,
  reception_perfect, reception_error, receive_attempt
)
SELECT
  COALESCE(vm.tournament_match_id, vm.id::text) AS match_id,
  vmp.global_player_id AS player_id,
  'vis-hub' AS team_id,
  vss.set_number,
  vss.spike_kill, vss.spike_error, vss.spike_attempt,
  vss.block_kill, vss.block_error, vss.block_rebound,
  vss.serve_ace, vss.serve_error, vss.serve_attempt,
  vss.dig_excellent, vss.dig_fault, vss.dig_attempt,
  vss.set_excellent, vss.set_fault, vss.set_attempt,
  vss.receive_excellent, vss.receive_error, vss.receive_attempt
FROM vis_set_stats vss
JOIN vis_match_players vmp ON vmp.id = vss.player_id
JOIN vis_matches vm ON vm.id = vss.match_id
WHERE vmp.global_player_id IS NOT NULL
ON CONFLICT DO NOTHING;
