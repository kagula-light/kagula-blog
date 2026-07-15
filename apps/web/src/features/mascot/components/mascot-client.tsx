"use client";

import type { ReactNode } from "react";

import { useMascotRuntime } from "../hooks/use-mascot-runtime";
import type { MascotLifecycleState } from "../types";

interface MascotClientProps {
  readonly children: ReactNode;
  readonly enabled: boolean;
  readonly modelUrl: string | null;
}

const stateMessages: Readonly<Record<MascotLifecycleState, string>> = {
  POSTER: "神乐静无月当前以静态海报陪伴。",
  LOADING: "正在加载看板娘。",
  ACTIVE: "看板娘已启动。",
  SLEEPING: "看板娘正在休眠。",
  DISMISSED: "看板娘已关闭。",
  ERROR: "动态模型暂时不可用，已保留静态海报。",
};

export function MascotClient({ children, enabled, modelUrl }: MascotClientProps) {
  const { state, hasModel, start, retry, sleep, dismiss } = useMascotRuntime({
    enabled,
    modelUrl,
  });

  if (state === "DISMISSED") {
    return (
      <div className="mascot-client mascot-client-dismissed" data-state={state}>
        <button
          className="mascot-launcher"
          type="button"
          aria-label="重新唤醒神乐静无月"
          title="重新唤醒神乐静无月"
          onClick={start}
        >
          &#x2726;
        </button>
        <span className="visually-hidden" role="status" aria-live="polite">
          {stateMessages[state]}
        </span>
      </div>
    );
  }

  return (
    <div className="mascot-client" data-state={state} data-has-model={hasModel}>
      <div className="mascot-poster" aria-hidden={state === "ACTIVE"}>
        {children}
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">
        {stateMessages[state]}
      </span>
      <div className="mascot-controls" aria-label="看板娘控制">
        {state === "POSTER" && hasModel ? (
          <button
            className="mascot-start-button"
            type="button"
            aria-label="唤醒神乐静无月"
            title="唤醒神乐静无月"
            onClick={start}
          >
            &#x25B6;
          </button>
        ) : null}
        {state === "ERROR" ? (
          <button type="button" aria-label="重试加载看板娘" title="重试加载看板娘" onClick={retry}>
            &#x21BB;
          </button>
        ) : null}
        {state === "SLEEPING" ? (
          <button type="button" aria-label="重新加载看板娘" title="重新加载看板娘" onClick={start}>
            &#x25B6;
          </button>
        ) : null}
        {state === "ACTIVE" ? (
          <button type="button" aria-label="休眠看板娘" title="休眠看板娘" onClick={sleep}>
            &#x23F8;
          </button>
        ) : null}
        <button type="button" aria-label="关闭看板娘" title="关闭看板娘" onClick={dismiss}>
          &#x2715;
        </button>
      </div>
    </div>
  );
}
