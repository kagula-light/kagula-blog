export interface MascotServerConfigInput {
  readonly enabled: boolean;
  readonly publicAssetBaseUrl: string;
  readonly modelPath?: string;
  readonly posterPath: string;
}

export interface MascotServerConfig {
  readonly enabled: boolean;
  readonly modelUrl: string | null;
  readonly posterPath: string;
}

function hasUnsafeSegments(value: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return true;
  }
  return decoded.split("/").some((segment) => segment === "." || segment === "..");
}

function validateModelPath(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    /^[a-z][a-z\d+.-]*:/iu.test(normalized) ||
    hasUnsafeSegments(normalized)
  ) {
    throw new Error("mascot model path must be a safe relative asset path");
  }
  return normalized;
}

function validatePosterPath(value: string): string {
  const normalized = value.trim();
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    hasUnsafeSegments(normalized)
  ) {
    throw new Error("mascot poster path must be a safe same-origin path");
  }
  return normalized;
}

export function createMascotServerConfig(input: MascotServerConfigInput): MascotServerConfig {
  const posterPath = validatePosterPath(input.posterPath);
  if (input.modelPath === undefined) {
    return { enabled: input.enabled, modelUrl: null, posterPath };
  }

  const modelPath = validateModelPath(input.modelPath);
  const baseUrl = new URL(
    input.publicAssetBaseUrl.endsWith("/")
      ? input.publicAssetBaseUrl
      : `${input.publicAssetBaseUrl}/`,
  );
  const modelUrl = new URL(modelPath, baseUrl);
  if (modelUrl.origin !== baseUrl.origin || !modelUrl.pathname.startsWith(baseUrl.pathname)) {
    throw new Error("mascot model path escapes the public asset base");
  }
  return {
    enabled: input.enabled,
    modelUrl: input.enabled ? modelUrl.toString() : null,
    posterPath,
  };
}
