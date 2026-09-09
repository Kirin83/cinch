import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

function needsSsl(url: string): boolean {
  if (process.env.PGSSL === "1" || process.env.PGSSL === "true") return true;
  if (process.env.PGSSL === "0" || process.env.PGSSL === "false") return false;
  if (/[?&]sslmode=(disable|allow|prefer)/i.test(url)) return /sslmode=require/i.test(url);
  return (
    /[?&]sslmode=(require|verify-ca|verify-full)/i.test(url) ||
    /\.(neon\.tech|pooler\.supabase\.com|supabase\.co|render\.com|amazonaws\.com)/i.test(url)
  );
}

function poolConfig(url: string): PoolConfig {
  const serverless = Boolean(process.env.VERCEL);
  const max = Number(process.env.PG_POOL_MAX ?? (serverless ? "1" : "8"));
  return {
    connectionString: url,
    max: Number.isFinite(max) && max > 0 ? max : serverless ? 1 : 8,
    idleTimeoutMillis: serverless ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
  };
}

export function db(): Pool {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) {
    pool = new Pool(poolConfig(url));
  }
  return pool;
}

export async function applySchema() {
  const sql = fs.readFileSync(path.join(process.cwd(), "schema.sql"), "utf8");
  await db().query(sql);
}
