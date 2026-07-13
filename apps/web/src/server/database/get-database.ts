import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";

import { getServerEnv } from "../config/env";

const databaseGlobal = globalThis as typeof globalThis & {
  kaguraDatabase?: DatabaseClient;
};

export function getDatabase(): DatabaseClient {
  if (!databaseGlobal.kaguraDatabase) {
    databaseGlobal.kaguraDatabase = createDatabaseClient(getServerEnv().DATABASE_URL);
  }

  return databaseGlobal.kaguraDatabase;
}
