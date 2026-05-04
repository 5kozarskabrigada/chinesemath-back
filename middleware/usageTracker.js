import { pool } from "../db.js";

/**
 * Lightweight middleware that logs per-request usage attributed to the
 * authenticated user. Fires AFTER response is sent so it never blocks.
 */
export function usageTracker(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    const userId = req.user?.id || null;
    if (!userId) return; // skip anonymous requests

    const userRole = req.user?.role || "unknown";
    const method = req.method;
    const rawPath = req.originalUrl.split("?")[0];
    const path = rawPath.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");

    pool
      .query(
        `INSERT INTO request_usage (user_id, user_role, method, path, status_code, response_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, userRole, method, path, res.statusCode, Math.round(elapsedMs)]
      )
      .catch((err) => {
        if (!usageTracker._warned) {
          console.warn("[usageTracker] Failed to log usage:", err.message);
          usageTracker._warned = true;
        }
      });
  });

  next();
}
