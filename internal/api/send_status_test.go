package api

import "testing"

func TestSendStatusUsesProviderState(t *testing.T) {
	for _, tt := range []struct {
		status  string
		allowed bool
		reason  string
	}{
		{"connected", true, ""},
		{"awaiting_message", false, "请在微信里发一条消息后再发送"},
		{"session_expired", false, "微信登录授权已失效，请重新扫码绑定"},
		{"disconnected", false, "Bot 未连接"},
	} {
		t.Run(tt.status, func(t *testing.T) {
			allowed, reason := checkSendStatus(tt.status)
			if allowed != tt.allowed || reason != tt.reason {
				t.Fatalf("got (%v, %q)", allowed, reason)
			}
		})
	}
}
