package ilink

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	sdk "github.com/openilink/openilink-sdk-go"
)

// SDK v0.6.0 SendMessage checks HTTP status but ignores ret/errcode in a
// successful HTTP response. Validate only sendmessage here so text, voice,
// and media sends all propagate business errors without changing polling.
type sendResponseClient struct{ client sdk.HTTPDoer }

func (c sendResponseClient) Do(req *http.Request) (*http.Response, error) {
	resp, err := c.client.Do(req)
	if err != nil {
		return resp, err
	}
	if !strings.HasSuffix(req.URL.Path, "/ilink/bot/sendmessage") || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return resp, nil
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read send response: %w", err)
	}
	var result sdk.APIError
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode send response: %w", err)
	}
	if result.Ret != 0 || result.ErrCode != 0 {
		return nil, &result
	}
	resp.Body = io.NopCloser(bytes.NewReader(body))
	return resp, nil
}
