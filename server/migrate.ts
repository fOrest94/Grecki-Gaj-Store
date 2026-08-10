import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDatabase, db } from "../db";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migracje bazy Grecki Gaj zostały zastosowane.");
} finally {
  await closeDatabase();
}
