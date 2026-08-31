// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SystemPromptVariablesDialog } from "./system-prompt-variables-dialog";

describe("SystemPromptVariablesDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("lists the supported prompt variables in a dialog", async () => {
    await act(async () => root.render(<SystemPromptVariablesDialog />));

    const trigger = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("动态参数"),
    );
    expect(trigger).toBeDefined();

    await act(async () => trigger?.click());

    expect(document.body.textContent).toContain("System Prompt 动态参数");
    expect(document.body.textContent).toContain("{{current_datetime}}");
    expect(document.body.textContent).toContain("[2026-08-31 22:30 周一]");
    expect(document.body.textContent).toContain("{{user_id}}");
  });
});
