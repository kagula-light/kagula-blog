const turnstileVerificationUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerificationInput {
  readonly secretKey: string;
  readonly responseToken: string;
  readonly clientAddress: string;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function verifyTurnstile(
  input: TurnstileVerificationInput,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  const body = new URLSearchParams({
    secret: input.secretKey,
    response: input.responseToken,
    remoteip: input.clientAddress,
  });

  try {
    const response = await fetcher(turnstileVerificationUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return (
      typeof payload === "object" &&
      payload !== null &&
      "success" in payload &&
      payload.success === true
    );
  } catch {
    return false;
  }
}
