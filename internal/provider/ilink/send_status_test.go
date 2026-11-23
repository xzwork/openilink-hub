package ilink

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openilink/openilink-hub/internal/provider"
	sdk "github.com/openilink/openilink-sdk-go"
)

func TestNeedsUserMessage(t *testing.T) {
	for _, tt := range []struct {
		name string
		err  error
		want bool
	}{
		{"missing cache", fmt.Errorf("push: %w", sdk.ErrNoContextToken), true},
		{"expired context", &sdk.APIError{Ret: -2, ErrMsg: "context_token expired"}, true},
		{"invalid context", &sdk.APIError{Ret: -2, ErrMsg: "invalid context token"}, true},
		{"ambiguous failure", &sdk.APIError{Ret: -2, ErrMsg: "prepare failed"}, false},
		{"login expired", &sdk.APIError{ErrCode: -14, ErrMsg: "context_token expired"}, false},
		{"network", context.DeadlineExceeded, false},
		{"http error", &sdk.HTTPError{StatusCode: 500, Body: []byte("context_token expired")}, false},
		{"success", nil, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := needsUserMessage(tt.err); got != tt.want {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSendRestrictionAndRecovery(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if calls.Add(1) == 1 {
			fmt.Fprint(w, `{"ret":-2,"errmsg":"context_token expired"}`)
		} else {
			fmt.Fprint(w, `{"ret":0}`)
		}
	}))
	defer server.Close()
	p := &Provider{client: sdk.NewClient("test", sdk.WithBaseURL(server.URL), sdk.WithHTTPClient(sendResponseClient{client: server.Client()})), creds: Credentials{ILinkUserID: "owner"}}
	var states []string
	p.onStatus = func(status string) { states = append(states, status) }
	p.setStatus("connected")
	msg := provider.OutboundMessage{Text: "hello", ContextToken: "old-token"}
	if _, err := p.Send(context.Background(), msg); !errors.Is(err, errAwaitingMessage) {
		t.Fatalf("expected actionable failure, got %v", err)
	}
	if p.Status() != "awaiting_message" {
		t.Fatal(p.Status())
	}
	if _, err := p.Send(context.Background(), msg); !errors.Is(err, errAwaitingMessage) {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("blocked send reached upstream")
	}
	p.receiveContext("someone-else", "token")
	p.receiveContext("owner", "")
	if p.Status() != "awaiting_message" {
		t.Fatal("unrelated message cleared restriction")
	}
	p.receiveContext("owner", "new-token")
	msg.ContextToken = "new-token"
	if _, err := p.Send(context.Background(), msg); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 || p.Status() != "connected" {
		t.Fatal("send did not recover")
	}
	if fmt.Sprint(states) != "[connected awaiting_message connected]" {
		t.Fatal(states)
	}
}

func TestSendFailuresKeepCorrectStatus(t *testing.T) {
	for _, tt := range []struct{ name, response, status string }{
		{"temporary", `{"ret":-2,"errmsg":"prepare failed"}`, "connected"},
		{"login", `{"errcode":-14,"errmsg":"session expired"}`, "session_expired"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, tt.response) }))
			defer server.Close()
			p := &Provider{client: sdk.NewClient("test", sdk.WithBaseURL(server.URL), sdk.WithHTTPClient(sendResponseClient{client: server.Client()}))}
			p.setStatus("connected")
			if _, err := p.Send(context.Background(), provider.OutboundMessage{Text: "hello", ContextToken: "token"}); err == nil {
				t.Fatal("expected error")
			}
			if p.Status() != tt.status {
				t.Fatalf("got %s, want %s", p.Status(), tt.status)
			}
		})
	}
}

func TestRestartRestoresRestrictionAndInboundRecovers(t *testing.T) {
	release := make(chan struct{})
	delivered := make(chan struct{})
	var polls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if polls.Add(1) == 1 {
			select {
			case <-release:
			case <-r.Context().Done():
				return
			}
			fmt.Fprint(w, `{"ret":0,"msgs":[{"from_user_id":"owner","context_token":"new-token","message_type":1,"item_list":[]}]}`)
		} else {
			<-r.Context().Done()
		}
	}))
	defer server.Close()
	creds, _ := json.Marshal(Credentials{BotToken: "test", ILinkUserID: "owner", BaseURL: server.URL})
	p := &Provider{}
	if err := p.Start(context.Background(), provider.StartOptions{
		Credentials: creds, InitialStatus: "awaiting_message",
		OnMessage: func(provider.InboundMessage) { close(delivered) },
	}); err != nil {
		t.Fatal(err)
	}
	defer p.Stop()
	if p.Status() != "awaiting_message" {
		t.Fatal("restart cleared restriction")
	}
	close(release)
	select {
	case <-delivered:
	case <-time.After(3 * time.Second):
		t.Fatal("inbound was not delivered")
	}
	if p.Status() != "connected" {
		t.Fatal("inbound did not restore sends")
	}
}
