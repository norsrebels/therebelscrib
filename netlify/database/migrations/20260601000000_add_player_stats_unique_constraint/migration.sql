ALTER TABLE "player_stats"
  ADD CONSTRAINT "player_stats_match_player_set_unique"
  UNIQUE ("match_id", "player_id", "set_number");
