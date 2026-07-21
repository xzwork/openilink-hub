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
  usePushListener: vi.fn(),
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

describe("ConsolePage message deletion", () => {
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
