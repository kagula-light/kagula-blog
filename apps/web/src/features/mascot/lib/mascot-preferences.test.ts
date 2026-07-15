import { describe, expect, it, vi } from "vitest";

import {
  MASCOT_PREFERENCE_KEY,
  clearMascotPreference,
  readMascotPreference,
  writeMascotPreference,
} from "./mascot-preferences";

interface TestStorage {
  readonly getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>;
  readonly setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
  readonly removeItem: ReturnType<typeof vi.fn<(key: string) => void>>;
}

function createStorage(value: string | null = null): TestStorage {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe("mascot preferences", () => {
  it("returns null when no preference was saved", () => {
    expect(readMascotPreference(createStorage())).toBeNull();
  });

  it("reads only the persisted dismissed preference", () => {
    const storage = createStorage("DISMISSED");

    expect(readMascotPreference(storage)).toBe("DISMISSED");
    expect(storage.getItem).toHaveBeenCalledWith(MASCOT_PREFERENCE_KEY);
  });

  it.each(["ACTIVE", "dismissed", "true", "{bad-json}"])(
    "ignores invalid persisted value %j",
    (value) => {
      expect(readMascotPreference(createStorage(value))).toBeNull();
    },
  );

  it("never throws when browser storage denies reads", () => {
    const storage = createStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(readMascotPreference(storage)).toBeNull();
  });

  it("writes and clears the dismissed preference", () => {
    const storage = createStorage();

    expect(() => writeMascotPreference("DISMISSED", storage)).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledWith(MASCOT_PREFERENCE_KEY, "DISMISSED");

    expect(() => clearMascotPreference(storage)).not.toThrow();
    expect(storage.removeItem).toHaveBeenCalledWith(MASCOT_PREFERENCE_KEY);
  });

  it("never throws when browser storage denies writes", () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("storage denied");
    });
    storage.removeItem.mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(() => writeMascotPreference("DISMISSED", storage)).not.toThrow();
    expect(() => clearMascotPreference(storage)).not.toThrow();
  });
});
