import { describe, expect, it } from "vitest";

import { evaluateFailureBudget } from "./login-rate-limiter";

describe("evaluateFailureBudget", () => {
  it.each([
    [0, -1, { allowed: true, retryAfterSeconds: 0 }],
    [4, 300, { allowed: true, retryAfterSeconds: 0 }],
    [5, 300, { allowed: false, retryAfterSeconds: 300 }],
    [8, -1, { allowed: false, retryAfterSeconds: 1 }],
  ] as const)("evaluates count %i and ttl %i", (count, ttl, expected) => {
    expect(evaluateFailureBudget(count, ttl)).toEqual(expected);
  });
});
