import { describe, expect, it } from "vitest";

import { evaluateRegistrationBudget } from "./registration-rate-limiter";

describe("evaluateRegistrationBudget", () => {
  it.each([1, 2, 3])("allows registration count %i in the active window", (count) => {
    expect(evaluateRegistrationBudget(count, 1200)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("blocks the fourth registration and preserves the remaining TTL", () => {
    expect(evaluateRegistrationBudget(4, 1200)).toEqual({
      allowed: false,
      retryAfterSeconds: 1200,
    });
  });

  it("returns a safe retry floor for a missing TTL", () => {
    expect(evaluateRegistrationBudget(4, -1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });
});
