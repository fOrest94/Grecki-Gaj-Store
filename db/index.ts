import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://grecki_gaj:grecki_gaj_dev_2026@localhost:5433/grecki_gaj";

export const sqlClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sqlClient, { schema });

export async function closeDatabase() {
  await sqlClient.end();
}
