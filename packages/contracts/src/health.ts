export type ServiceName = "web" | "worker";
export type HealthStatus = "ok" | "error";

export interface HealthCheck {
  readonly status: HealthStatus;
  readonly durationMs: number;
}

export interface HealthResponseInput {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly release: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthCheck>>;
}

export interface HealthResponse {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly release: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthCheck>>;
}

export function createHealthResponse(input: HealthResponseInput): HealthResponse {
  const response = {
    service: input.service,
    status: input.status,
    release: input.release,
    timestamp: input.timestamp,
  };

  if (input.checks === undefined) {
    return response;
  }

  return { ...response, checks: input.checks };
}
