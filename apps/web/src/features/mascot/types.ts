export const mascotLifecycleStates = [
  "POSTER",
  "LOADING",
  "ACTIVE",
  "SLEEPING",
  "DISMISSED",
  "ERROR",
] as const;

export type MascotLifecycleState = (typeof mascotLifecycleStates)[number];

export const MASCOT_WELCOME_COMPLETE_EVENT = "kagura:welcome-complete";
export const MASCOT_WELCOME_SESSION_KEY = "kagura-welcome-seen";

export interface MascotRuntime {
  readonly sleep: () => void;
  readonly destroy: () => Promise<void>;
}
