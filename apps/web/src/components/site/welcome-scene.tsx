"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  MASCOT_WELCOME_COMPLETE_EVENT,
  MASCOT_WELCOME_SESSION_KEY,
} from "../../features/mascot/types";

interface WelcomeSceneProps {
  readonly mainContentId: string;
}

type ScenePhase = "VISIBLE" | "LEAVING" | "HIDDEN";

function beijingClock(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

export function WelcomeScene({ mainContentId }: WelcomeSceneProps) {
  const [phase, setPhase] = useState<ScenePhase>("VISIBLE");
  const [now, setNow] = useState(() => new Date());
  const skipButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem(MASCOT_WELCOME_SESSION_KEY) === "1") {
      const hideTimer = window.setTimeout(() => {
        setPhase("HIDDEN");
        window.dispatchEvent(new Event(MASCOT_WELCOME_COMPLETE_EVENT));
      }, 0);
      return () => window.clearTimeout(hideTimer);
    }
    skipButtonRef.current?.focus({ preventScroll: true });
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  function enterLibrary() {
    window.sessionStorage.setItem(MASCOT_WELCOME_SESSION_KEY, "1");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setPhase("HIDDEN");
      window.dispatchEvent(new Event(MASCOT_WELCOME_COMPLETE_EVENT));
      document.getElementById(mainContentId)?.focus({ preventScroll: true });
      return;
    }
    setPhase("LEAVING");
    window.setTimeout(() => {
      setPhase("HIDDEN");
      window.dispatchEvent(new Event(MASCOT_WELCOME_COMPLETE_EVENT));
      document.getElementById(mainContentId)?.focus({ preventScroll: true });
    }, 420);
  }

  if (phase === "HIDDEN") return null;

  return (
    <section
      className={`welcome-scene ${phase === "LEAVING" ? "welcome-scene-leaving" : ""}`}
      aria-labelledby="welcome-title"
      aria-modal="true"
      role="dialog"
    >
      <picture className="welcome-art">
        <source media="(max-width: 40rem)" srcSet="/brand/kagura-hero-mobile.webp" />
        <Image src="/brand/kagura-hero.webp" alt="" fill priority sizes="100vw" />
      </picture>
      <div className="welcome-vignette" aria-hidden="true" />
      <div className="welcome-content">
        <time dateTime={now.toISOString()}>{beijingClock(now)}</time>
        <p>神乐静无月的私人星图书库</p>
        <h1 id="welcome-title">神乐的无月之境</h1>
        <blockquote>“愿每一次凝视代码，都能看见世界的另一种运行方式。”</blockquote>
        <button ref={skipButtonRef} type="button" onClick={enterLibrary}>
          进入书库
        </button>
      </div>
    </section>
  );
}
