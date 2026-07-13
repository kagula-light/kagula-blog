import { createHealthResponse, type HealthResponse } from "@kagura/contracts/health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(): NextResponse<HealthResponse> {
  const response = createHealthResponse({
    service: "web",
    status: "ok",
    release: process.env.APP_RELEASE ?? "dev",
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(response, { status: 200 });
}
