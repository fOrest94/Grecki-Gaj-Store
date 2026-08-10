import "dotenv/config";
import { closeDatabase } from "../db";
import { runRetention } from "./retention";

try {
  const result = await runRetention();
  console.log("Retencja zakończona:", result);
} finally {
  await closeDatabase();
}
