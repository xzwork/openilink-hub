import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

import type { MessageItemData } from "./message-items";

export type Message = {
  id: number;
  bot_id?: string;
  direction: string;
  item_list: MessageItemData[];
  media_status?: string;
  media_keys?: Record<string, string>;
  created_at: number;
  _sending?: boolean;
  _error?: string;
};

export function useMessageHistory(botId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [canSend, setCanSend] = useState(true);
  const [sendDisabledReason, setSendDisabledReason] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const first = useRef(true);
  const cursor = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const busy = useRef(false);
  const latestBusy = useRef(false);
  const pending = useRef(false);
  const currentMessages = useRef(messages);
  currentMessages.current = messages;
  const anchor = useRef<{ height: number; top: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!botId) return;
    if (latestBusy.current) {
      pending.current = true;
      return;
    }
    latestBusy.current = true;
    const version = generation.current;
    try {
      const res = await api.messages(botId, 50);
      if (version !== generation.current) return;
      const incoming = [...(res.messages || [])];
      const newest = currentMessages.current[currentMessages.current.length - 1]?.id;
      let page = res;
      while (newest !== undefined && page.has_more && incoming[incoming.length - 1]?.id > newest) {
        page = await api.messages(botId, 50, page.next_cursor);
        if (version !== generation.current) return;
        incoming.push(...(page.messages || []));
        if (!page.messages?.length) break;
      }
      if (first.current) {
        cursor.current = res.has_more ? res.next_cursor : undefined;
        setHasMore(!!res.has_more);
      }
      setMessages((current) =>
        [...new Map([...current, ...incoming].map((m) => [m.id, m])).values()].sort(
          (a, b) => a.id - b.id,
        ),
      );
      setLoadError("");
      if (res.can_send !== undefined) {
        setCanSend(res.can_send);
        setSendDisabledReason(res.send_disabled_reason);
      }
    } catch (err: any) {
      if (version === generation.current) setLoadError(err?.message || "消息加载失败");
    } finally {
      if (version === generation.current) {
        setLoading(false);
        latestBusy.current = false;
        if (pending.current) {
          pending.current = false;
          void fetchData();
        }
      }
    }
  }, [botId]);

  const loadOlder = useCallback(async () => {
    if (!botId || !cursor.current || busy.current) return;
    const version = generation.current;
    busy.current = true;
    setLoadingOlder(true);
    setHistoryError("");
    try {
      const res = await api.messages(botId, 50, cursor.current);
      if (version !== generation.current) return;
      const el = scrollRef.current;
      if (el && !stickToBottomRef.current) {
        anchor.current = { height: el.scrollHeight, top: el.scrollTop };
      }
      cursor.current = res.has_more ? res.next_cursor : undefined;
      setHasMore(!!res.has_more);
      setMessages((current) =>
        [...new Map([...(res.messages || []), ...current].map((m) => [m.id, m])).values()].sort(
          (a, b) => a.id - b.id,
        ),
      );
    } catch (err: any) {
      if (version === generation.current) setHistoryError(err?.message || "历史消息加载失败");
    } finally {
      if (version === generation.current) {
        busy.current = false;
        setLoadingOlder(false);
      }
    }
  }, [botId]);

  const reset = useCallback(() => {
    generation.current++;
    busy.current = false;
    latestBusy.current = false;
    pending.current = false;
    cursor.current = undefined;
    anchor.current = null;
    first.current = true;
    stickToBottomRef.current = true;
    currentMessages.current = [];
    setMessages([]);
    setHasMore(false);
    setLoadingOlder(false);
    setHistoryError("");
    setLoadError("");
  }, []);

  useEffect(() => {
    reset();
    setLoading(true);
    void fetchData();
    return () => {
      generation.current++;
    };
  }, [fetchData, reset]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || loading || loadError) return;
    if (anchor.current) {
      el.scrollTop = anchor.current.top + el.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (first.current) {
      el.scrollTop = el.scrollHeight;
      first.current = false;
    } else if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading, loadError]);

  // Images, fonts and viewport changes can resize the list after the first paint.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || loading || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current && !anchor.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (
      el &&
      !loading &&
      !loadingOlder &&
      !historyError &&
      hasMore &&
      el.scrollHeight <= el.clientHeight
    )
      void loadOlder();
  }, [messages, loading, loadingOlder, historyError, hasMore, loadOlder]);

  return {
    messages,
    setMessages,
    loading,
    loadError,
    historyError,
    loadingOlder,
    hasMore,
    canSend,
    sendDisabledReason,
    scrollRef,
    contentRef,
    stickToBottomRef,
    fetchData,
    loadOlder,
    reset,
  };
}
