import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { ensureVectorExtension } from "@/lib/db/ensure-vector-extension";

config({
  path: ".env.local",
});

const runPush = async () => {
  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL not defined, skipping db push");
    process.exit(1);
  }

  console.log("Ensuring pgvector extension...");
  await ensureVectorExtension(process.env.POSTGRES_URL);

  console.log("Running drizzle push...");
  execFileSync("pnpm", ["exec", "drizzle-kit", "push"], {
    stdio: "inherit",
  });
};

runPush().catch((err) => {
  console.error("Database push failed");
  console.error(err);
  process.exit(1);
});
