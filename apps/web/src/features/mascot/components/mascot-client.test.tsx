import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseMascotRuntimeResult } from "../hooks/use-mascot-runtime";

const mocks = vi.hoisted(() => ({
  useMascotRuntime: vi.fn(),
}));

vi.mock("../hooks/use-mascot-runtime", () => ({
  useMascotRuntime: mocks.useMascotRuntime,
}));

import { MascotClient } from "./mascot-client";

function renderState(state: UseMascotRuntimeResult["state"], hasModel = true): string {
  mocks.useMascotRuntime.mockReturnValue({
    state,
    hasModel,
    start: vi.fn(),
    retry: vi.fn(),
    sleep: vi.fn(),
    dismiss: vi.fn(),
  } satisfies UseMascotRuntimeResult);

  return renderToStaticMarkup(
    <MascotClient enabled modelUrl="https://assets.example.com/model3.json">
      <span>poster</span>
    </MascotClient>,
  );
}

describe("MascotClient", () => {
  beforeEach(() => mocks.useMascotRuntime.mockReset());

  it("renders a stable reopen control after dismissal", () => {
    const markup = renderState("DISMISSED");

    expect(markup).toContain('data-state="DISMISSED"');
    expect(markup).toContain('aria-label="重新唤醒神乐静无月"');
    expect(markup).not.toContain('aria-label="关闭看板娘"');
  });

  it("renders retry and close controls after a model error", () => {
    const markup = renderState("ERROR");

    expect(markup).toContain('aria-label="重试加载看板娘"');
    expect(markup).toContain('aria-label="关闭看板娘"');
    expect(markup).not.toContain('aria-label="休眠看板娘"');
  });

  it("renders sleep and close controls only while active", () => {
    const markup = renderState("ACTIVE");

    expect(markup).toContain('aria-label="休眠看板娘"');
    expect(markup).toContain('aria-label="关闭看板娘"');
    expect(markup).not.toContain('aria-label="重试加载看板娘"');
  });

  it("keeps poster-only mode free of a broken start control", () => {
    const markup = renderState("POSTER", false);

    expect(markup).toContain("poster");
    expect(markup).not.toContain('aria-label="唤醒神乐静无月"');
    expect(markup).toContain('aria-label="关闭看板娘"');
  });
});
