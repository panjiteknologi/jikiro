import postgres from "postgres";

export async function ensureVectorExtension(connectionString: string) {
  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  } finally {
    await sql.end();
  }
}
