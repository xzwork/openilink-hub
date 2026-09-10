// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsolePage } from "./console-page";

const messagesMock = vi.fn();
const deleteMessagesMock = vi.fn();
const clearMessagesMock = vi.fn();
const confirmMock = vi.fn();
const toastMock = vi.fn();
let pushListener: (event: any) => void;

const testMessages = [
  {
    id: 2,
    direction: "outbound",
    item_list: [{ type: "text", text: "reply" }],
    created_at: 2,
  },
  {
    id: 1,
    direction: "inbound",
    item_list: [{ type: "text", text: "question" }],
    created_at: 1,
  },
];

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ id: "bot-1" }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    messages: (...args: any[]) => messagesMock(...args),
    deleteMessages: (...args: any[]) => deleteMessagesMock(...args),
    clearMessages: (...args: any[]) => clearMessagesMock(...args),
    sendMessage: vi.fn(),
  },
}));

vi.mock("@/lib/ws", () => ({
  useBotPush: vi.fn(),
  usePushListener: (listener: (event: any) => void) => {
    pushListener = listener;
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => ({
    confirm: (...args: any[]) => confirmMock(...args),
    ConfirmDialog: null,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
}));

describe("ConsolePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    messagesMock.mockReset();
    messagesMock.mockResolvedValue({ messages: testMessages, can_send: true });
    deleteMessagesMock.mockResolvedValue({ ok: true, deleted: 1 });
    clearMessagesMock.mockResolvedValue({ ok: true, deleted: 2 });
    confirmMock.mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root.render(<ConsolePage />);
    });
    await vi.waitFor(() => expect(container.textContent).toContain("question"));
  }

  function buttonNamed(name: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === name,
    );
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  function scroller() {
    return container.querySelector('[role="log"]') as HTMLDivElement;
  }

  function mockViewport() {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this.querySelectorAll("[data-message-id]").length * 300;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 200,
    });
  }

  it("opens at the latest message and prepends successive pages without moving the reading position", async () => {
    mockViewport();
    messagesMock.mockResolvedValueOnce({
      messages: testMessages,
      has_more: true,
      next_cursor: "page-2",
    });
    await renderPage();
    expect(scroller().scrollTop).toBe(600);
    const older = {
      ...testMessages[1],
      id: 0,
      created_at: -86400,
      item_list: [{ type: "text", text: "older" }],
    };
    messagesMock.mockResolvedValueOnce({
      messages: [older],
      has_more: true,
      next_cursor: "page-3",
    });
    await act(async () => {
      scroller().scrollTop = 20;
      scroller().dispatchEvent(new Event("scroll"));
    });
    expect(messagesMock).toHaveBeenLastCalledWith("bot-1", 50, "page-2");
    expect(scroller().scrollTop).toBe(320);
    expect(
      Array.from(container.querySelectorAll("[data-message-id]")).map((el) =>
        el.getAttribute("data-message-id"),
      ),
    ).toEqual(["0", "1", "2"]);
    expect(container.textContent).toContain(
      new Date(older.created_at * 1000).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
    messagesMock.mockResolvedValueOnce({ messages: [], has_more: false });
    await act(async () => {
      scroller().scrollTop = 0;
      scroller().dispatchEvent(new Event("scroll"));
    });
    expect(messagesMock).toHaveBeenLastCalledWith("bot-1", 50, "page-3");
    expect(container.textContent).toContain("已到最早的消息");
    const count = messagesMock.mock.calls.length;
    await act(async () => scroller().dispatchEvent(new Event("scroll")));
    expect(messagesMock).toHaveBeenCalledTimes(count);

    messagesMock.mockResolvedValueOnce({
      messages: [{ ...testMessages[0], id: 3, item_list: [{ type: "text", text: "new arrival" }] }],
      has_more: true,
      next_cursor: "ignored",
    });
    await act(async () => pushListener({ type: "message_new", data: { bot_id: "bot-1" } }));
    expect(container.textContent).toContain("older");
    expect(container.textContent).toContain("new arrival");
    expect(container.querySelectorAll("[data-message-id]")).toHaveLength(4);
    expect(scroller().scrollTop).toBe(0);
  });

  it("follows resized content at the bottom without interrupting upward reading", async () => {
    mockViewport();
    let onResize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      await renderPage();
      Object.defineProperty(scroller(), "scrollHeight", { configurable: true, value: 1200 });
      await act(async () => onResize());
      expect(scroller().scrollTop).toBe(1200);
      await act(async () => {
        scroller().scrollTop = 300;
        scroller().dispatchEvent(new Event("scroll"));
      });
      Object.defineProperty(scroller(), "scrollHeight", { configurable: true, value: 1500 });
      await act(async () => onResize());
      expect(scroller().scrollTop).toBe(300);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps history visible on pagination failure and retries the same cursor", async () => {
    mockViewport();
    messagesMock.mockResolvedValueOnce({
      messages: testMessages,
      has_more: true,
      next_cursor: "older",
    });
    await renderPage();
    messagesMock.mockRejectedValueOnce(new Error("网络错误"));
    await act(async () => {
      scroller().scrollTop = 0;
      scroller().dispatchEvent(new Event("scroll"));
    });
    expect(container.textContent).toContain("question");
    messagesMock.mockResolvedValueOnce({ messages: [], has_more: false });
    await act(async () => buttonNamed("网络错误，点击重试").click());
    expect(messagesMock).toHaveBeenLastCalledWith("bot-1", 50, "older");
    expect(container.textContent).toContain("已到最早的消息");
  });

  it("selects and permanently deletes individual messages", async () => {
    await renderPage();

    await act(async () => buttonNamed("多选").click());
    const checkbox = container.querySelector('input[aria-label="选择消息 1"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    await act(async () => checkbox.click());
    expect(container.textContent).toContain("已选 1 条");

    messagesMock.mockResolvedValueOnce({ messages: [testMessages[0]], can_send: true });
    await act(async () => buttonNamed("删除").click());

    await vi.waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "删除 1 条消息？", variant: "destructive" }),
      );
      expect(deleteMessagesMock).toHaveBeenCalledWith("bot-1", [1]);
      expect(toastMock).toHaveBeenCalledWith({ title: "已删除 1 条消息" });
    });
  });

  it("clears all messages after destructive confirmation", async () => {
    await renderPage();

    await act(async () => buttonNamed("清空").click());

    await vi.waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "清空全部聊天记录？", variant: "destructive" }),
      );
      expect(clearMessagesMock).toHaveBeenCalledWith("bot-1");
      expect(container.textContent).toContain("暂无消息");
    });
  });
});
