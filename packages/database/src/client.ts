import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export type DatabaseClient = Readonly<{
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
  readonly client: Sql;
  readonly close: () => Promise<void>;
}>;

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
