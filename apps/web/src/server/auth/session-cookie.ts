export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly expires: Date;
}

export interface SessionCookieStore {
  readonly get: (name: string) => Readonly<{ value: string }> | undefined;
  readonly set: (name: string, value: string, options: SessionCookieOptions) => void;
}

export interface SetSessionCookieInput {
  readonly name: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly secure: boolean;
}

export function readSessionCookie(store: SessionCookieStore, name: string): string | null {
  return store.get(name)?.value ?? null;
}

export function setSessionCookie(
  store: SessionCookieStore,
  { name, token, expiresAt, secure }: SetSessionCookieInput,
): void {
  store.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(
  store: SessionCookieStore,
  { name, secure }: Readonly<{ name: string; secure: boolean }>,
): void {
  store.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(0),
  });
}
