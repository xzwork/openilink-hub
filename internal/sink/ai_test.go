package sink

import (
	"testing"

	"github.com/openilink/openilink-hub/internal/store"
)

func TestResolveConfigUsesCustomBotConfig(t *testing.T) {
	botConfig := store.AIConfig{
		Source: "custom", BaseURL: "https://bot.example.com/v1", APIKey: "bot-key", Model: "bot-model",
	}
	s := &AI{}
	got := s.resolveConfig(botConfig, "legacy-model")
	if got.BaseURL != botConfig.BaseURL || got.APIKey != botConfig.APIKey || got.Model != botConfig.Model {
		t.Fatalf("resolveConfig() = %+v, want bot config %+v", got, botConfig)
	}
}

func TestParseCustomHeaders_ObjectFormat(t *testing.T) {
	m := parseCustomHeaders(`{"HTTP-Referer":"https://openclaw.ai","X-Title":"OpenClaw"}`)
	if m == nil {
		t.Fatal("expected non-nil map")
	}
	if m["HTTP-Referer"] != "https://openclaw.ai" {
		t.Errorf("HTTP-Referer = %q", m["HTTP-Referer"])
	}
	if m["X-Title"] != "OpenClaw" {
		t.Errorf("X-Title = %q", m["X-Title"])
	}
}

func TestParseCustomHeaders_ArrayFormat(t *testing.T) {
	m := parseCustomHeaders(`[["HTTP-Referer","https://openclaw.ai"],["X-Title","OpenClaw"]]`)
	if m == nil {
		t.Fatal("expected non-nil map")
	}
	if m["HTTP-Referer"] != "https://openclaw.ai" {
		t.Errorf("HTTP-Referer = %q", m["HTTP-Referer"])
	}
}

func TestParseCustomHeaders_EmptyKeyFiltered(t *testing.T) {
	m := parseCustomHeaders(`[["","value"],["X-Good","ok"]]`)
	if _, ok := m[""]; ok {
		t.Error("empty key should be filtered")
	}
	if m["X-Good"] != "ok" {
		t.Errorf("X-Good = %q", m["X-Good"])
	}
}

func TestParseCustomHeaders_InvalidJSON(t *testing.T) {
	m := parseCustomHeaders(`not json`)
	if m != nil {
		t.Errorf("expected nil for invalid JSON, got %v", m)
	}
}

func TestParseCustomHeaders_Empty(t *testing.T) {
	m := parseCustomHeaders(`{}`)
	if m != nil {
		t.Errorf("expected nil for empty object, got %v", m)
	}
	m = parseCustomHeaders(`[]`)
	if m != nil {
		t.Errorf("expected nil for empty array, got %v", m)
	}
}
