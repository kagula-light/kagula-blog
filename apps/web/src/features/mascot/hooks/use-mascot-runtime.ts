"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadMascot } from "../lib/load-mascot";
import {
  clearMascotPreference,
  readMascotPreference,
  writeMascotPreference,
} from "../lib/mascot-preferences";
import {
  MASCOT_WELCOME_COMPLETE_EVENT,
  MASCOT_WELCOME_SESSION_KEY,
  type MascotLifecycleState,
  type MascotRuntime,
} from "../types";

export interface MascotAutoLoadContext {
  readonly enabled: boolean;
  readonly modelUrl: string | null;
  readonly desktop: boolean;
  readonly reducedMotion: boolean;
  readonly dismissed: boolean;
  readonly welcomeComplete: boolean;
  readonly automaticAttempted: boolean;
}

export interface MascotIdleScheduler {
  readonly requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
  readonly cancelIdleCallback?: (handle: number) => void;
  readonly setTimeout: (callback: () => void, timeout: number) => number;
  readonly clearTimeout: (handle: number) => void;
}

export interface UseMascotRuntimeOptions {
  readonly enabled: boolean;
  readonly modelUrl: string | null;
}

export interface UseMascotRuntimeResult {
  readonly state: MascotLifecycleState;
  readonly hasModel: boolean;
  readonly start: () => void;
  readonly retry: () => void;
  readonly sleep: () => void;
  readonly dismiss: () => void;
}

export function shouldAutoLoadMascot(context: MascotAutoLoadContext): boolean {
  return (
    context.enabled &&
    context.modelUrl !== null &&
    context.desktop &&
    !context.reducedMotion &&
    !context.dismissed &&
    context.welcomeComplete &&
    !context.automaticAttempted
  );
}

export function scheduleMascotIdleTask(
  scheduler: MascotIdleScheduler,
  task: () => void,
): () => void {
  if (scheduler.requestIdleCallback && scheduler.cancelIdleCallback) {
    const handle = scheduler.requestIdleCallback(task, { timeout: 2_000 });
    return () => scheduler.cancelIdleCallback?.(handle);
  }

  const handle = scheduler.setTimeout(task, 600);
  return () => scheduler.clearTimeout(handle);
}

function welcomeAlreadyCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(MASCOT_WELCOME_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function destroyWithoutThrowing(runtime: MascotRuntime | null): void {
  if (!runtime) return;
  void runtime.destroy().catch(() => undefined);
}

export function useMascotRuntime({
  enabled,
  modelUrl,
}: UseMascotRuntimeOptions): UseMascotRuntimeResult {
  const [state, setState] = useState<MascotLifecycleState>("POSTER");
  const [desktop, setDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [welcomeComplete, setWelcomeComplete] = useState(false);
  const runtimeRef = useRef<MascotRuntime | null>(null);
  const automaticAttemptedRef = useRef(false);
  const attemptRef = useRef(0);
  const cancelIdleRef = useRef<(() => void) | null>(null);

  const loadRuntime = useCallback(
    async (clearDismissed: boolean) => {
      if (!enabled || !modelUrl) return;
      cancelIdleRef.current?.();
      cancelIdleRef.current = null;
      if (clearDismissed) clearMascotPreference();

      const attempt = ++attemptRef.current;
      const previousRuntime = runtimeRef.current;
      runtimeRef.current = null;
      setState("LOADING");
      if (previousRuntime) {
        try {
          await previousRuntime.destroy();
        } catch {
          // A failed teardown must not prevent a fresh explicit attempt.
        }
      }

      try {
        const runtime = await loadMascot(modelUrl);
        if (attemptRef.current !== attempt) {
          destroyWithoutThrowing(runtime);
          return;
        }
        runtimeRef.current = runtime;
        setState("ACTIVE");
      } catch {
        if (attemptRef.current === attempt) setState("ERROR");
      }
    },
    [enabled, modelUrl],
  );

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 769px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMedia = () => {
      setDesktop(desktopQuery.matches);
      setReducedMotion(reducedMotionQuery.matches);
    };
    const markWelcomeComplete = () => setWelcomeComplete(true);

    const initialStateTimer = window.setTimeout(() => {
      syncMedia();
      if (readMascotPreference() === "DISMISSED") setState("DISMISSED");
      if (welcomeAlreadyCompleted()) setWelcomeComplete(true);
    }, 0);
    desktopQuery.addEventListener("change", syncMedia);
    reducedMotionQuery.addEventListener("change", syncMedia);
    window.addEventListener(MASCOT_WELCOME_COMPLETE_EVENT, markWelcomeComplete);

    return () => {
      window.clearTimeout(initialStateTimer);
      desktopQuery.removeEventListener("change", syncMedia);
      reducedMotionQuery.removeEventListener("change", syncMedia);
      window.removeEventListener(MASCOT_WELCOME_COMPLETE_EVENT, markWelcomeComplete);
    };
  }, []);

  useEffect(() => {
    const canAutoLoad = shouldAutoLoadMascot({
      enabled,
      modelUrl,
      desktop,
      reducedMotion,
      dismissed: state === "DISMISSED",
      welcomeComplete,
      automaticAttempted: automaticAttemptedRef.current,
    });
    if (!canAutoLoad) return;

    automaticAttemptedRef.current = true;
    const scheduler = window as unknown as MascotIdleScheduler;
    cancelIdleRef.current = scheduleMascotIdleTask(scheduler, () => {
      cancelIdleRef.current = null;
      void loadRuntime(false);
    });
    return () => {
      cancelIdleRef.current?.();
      cancelIdleRef.current = null;
    };
  }, [desktop, enabled, loadRuntime, modelUrl, reducedMotion, state, welcomeComplete]);

  useEffect(() => {
    const sleepWhenHidden = () => {
      if (!document.hidden || !runtimeRef.current) return;
      runtimeRef.current.sleep();
      setState("SLEEPING");
    };
    document.addEventListener("visibilitychange", sleepWhenHidden);
    return () => document.removeEventListener("visibilitychange", sleepWhenHidden);
  }, []);

  useEffect(
    () => () => {
      attemptRef.current += 1;
      cancelIdleRef.current?.();
      cancelIdleRef.current = null;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      destroyWithoutThrowing(runtime);
    },
    [],
  );

  function start(): void {
    void loadRuntime(true);
  }

  function retry(): void {
    void loadRuntime(false);
  }

  function sleep(): void {
    if (!runtimeRef.current) return;
    runtimeRef.current.sleep();
    setState("SLEEPING");
  }

  function dismiss(): void {
    attemptRef.current += 1;
    automaticAttemptedRef.current = true;
    cancelIdleRef.current?.();
    cancelIdleRef.current = null;
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    writeMascotPreference("DISMISSED");
    setState("DISMISSED");
    destroyWithoutThrowing(runtime);
  }

  return {
    state,
    hasModel: modelUrl !== null,
    start,
    retry,
    sleep,
    dismiss,
  };
}
