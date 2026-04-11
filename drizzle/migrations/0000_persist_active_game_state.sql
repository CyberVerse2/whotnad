ALTER TABLE "matches"
ADD COLUMN "game_match_id" text,
ADD COLUMN "game_state" jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS "matches_game_match_id_idx"
ON "matches" ("game_match_id");
