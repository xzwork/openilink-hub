-- +goose Up
ALTER TABLE bots ADD COLUMN ai_config TEXT NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE bots DROP COLUMN ai_config;
