import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  ssl: DATABASE_URL.includes("sslmode=") ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  console.log("Neon PostgreSQL: new connection established");
});

pool.on("error", (err) => {
  console.error("Neon PostgreSQL pool error:", err.message);
});

export async function checkDbHealth() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW() AS now");
    return { ok: true, time: result.rows[0].now };
  } finally {
    client.release();
  }
}

export async function queryWithRetry(text, params, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 300;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const transientCodes = ["57P01", "08006", "08001", "08004", "ECONNRESET", "ETIMEDOUT"];
      const isTransient =
        transientCodes.includes(err.code) || (err.message && err.message.includes("Connection terminated"));
      if (!isTransient || attempt === maxAttempts) throw err;
      const waitMs = baseDelayMs * attempt;
      console.warn(
        `[queryWithRetry] Transient error (attempt ${attempt}/${maxAttempts}): ${err.code || err.message}. Retrying in ${waitMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
