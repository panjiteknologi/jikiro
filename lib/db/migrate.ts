import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { ensureVectorExtension } from "@/lib/db/ensure-vector-extension";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping migrations");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Running migrations...");

  console.log("Ensuring pgvector extension...");
  await ensureVectorExtension(process.env.POSTGRES_URL);

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Migrations completed in", end - start, "ms");

  if (process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres") {
    process.env.WORKFLOW_POSTGRES_URL ??= process.env.POSTGRES_URL;

    console.log("Running Workflow Postgres setup...");

    execFileSync("pnpm", ["exec", "workflow-postgres-setup"], {
      stdio: "inherit",
    });
  }

  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed");
  console.error(err);
  process.exit(1);
});
