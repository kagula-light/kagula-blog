import { createDatabaseClient } from "@kagura/database/client";
import { checkDatabaseReadiness } from "@kagura/database/readiness";
import { NextResponse } from "next/server";

import { getServerEnv } from "../../../../server/config/env";
import { checkReadiness } from "../../../../server/health/check-readiness";
import { checkRedisReadiness } from "../../../../server/redis/check-redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const response = await checkReadiness({
    release: env.APP_RELEASE,
    checkDatabase: async () => {
      const database = createDatabaseClient(env.DATABASE_URL);
      try {
        return await checkDatabaseReadiness({ execute: async () => database.client`select 1` });
      } finally {
        await database.close();
      }
    },
    checkRedis: async () => checkRedisReadiness({ redisUrl: env.REDIS_URL }),
  });

  return NextResponse.json(response, { status: response.status === "ok" ? 200 : 503 });
}
