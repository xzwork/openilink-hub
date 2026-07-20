-- +goose Up
ALTER TABLE bots ADD COLUMN IF NOT EXISTS ai_config JSONB NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE bots DROP COLUMN IF EXISTS ai_config;
