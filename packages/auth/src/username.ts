const usernamePattern = /^[a-z0-9_]{3,32}$/;

export function normalizeUsername(value: string): string {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (!usernamePattern.test(normalized)) {
    throw new Error("Username must contain 3-32 lowercase letters, numbers, or underscores");
  }

  return normalized;
}
