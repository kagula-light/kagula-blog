import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { HealthResponse } from "@kagura/contracts/health";

export interface CreateHealthServerOptions {
  readonly port: number;
  readonly getLiveness: () => HealthResponse;
  readonly getReadiness: () => Promise<HealthResponse>;
}

export interface HealthServer {
  readonly server: Server;
  readonly listen: () => void;
  readonly port: () => number;
  readonly close: () => Promise<void>;
}

const jsonHeaders = { "content-type": "application/json; charset=utf-8" } as const;

export function createHealthServer({
  port,
  getLiveness,
  getReadiness,
}: CreateHealthServerOptions): HealthServer {
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health/live") {
      response.writeHead(200, jsonHeaders).end(JSON.stringify(getLiveness()));
      return;
    }

    if (request.method === "GET" && request.url === "/health/ready") {
      try {
        const readiness = await getReadiness();
        response
          .writeHead(readiness.status === "ok" ? 200 : 503, jsonHeaders)
          .end(JSON.stringify(readiness));
      } catch {
        response.writeHead(503, jsonHeaders).end(JSON.stringify({ status: "error" }));
      }
      return;
    }

    response.writeHead(404, jsonHeaders).end(JSON.stringify({ status: "not_found" }));
  });

  return {
    server,
    listen: () => server.listen(port, "0.0.0.0"),
    port: () => {
      const address = server.address() as AddressInfo | null;
      if (!address) {
        throw new Error("Worker health server is not listening");
      }
      return address.port;
    },
    close: async () => {
      if (!server.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
