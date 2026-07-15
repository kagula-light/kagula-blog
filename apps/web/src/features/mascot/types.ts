export const mascotLifecycleStates = [
  "POSTER",
  "LOADING",
  "ACTIVE",
  "SLEEPING",
  "DISMISSED",
  "ERROR",
] as const;

export type MascotLifecycleState = (typeof mascotLifecycleStates)[number];

export interface MascotRuntime {
  readonly sleep: () => void;
  readonly destroy: () => Promise<void>;
}
