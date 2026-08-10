import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://grecki_gaj:grecki_gaj_dev_2026@localhost:5433/grecki_gaj",
  },
  verbose: true,
  strict: true,
});
