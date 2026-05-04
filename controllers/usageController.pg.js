import { pool } from "../db.js";

/**
 * GET /api/admin/usage/per-student
 * Returns per-user usage stats for cost attribution.
 */
export const getPerStudentUsage = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const from = req.query.from || startOfMonth;
    const rawTo = req.query.to || now.toISOString();
    const to = rawTo.length === 10 ? `${rawTo}T23:59:59.999Z` : rawTo;

    const { rows } = await pool.query(
      `SELECT
          ru.user_id, ru.user_role,
          u.first_name, u.last_name, u.username, u.email,
          COUNT(*)::int AS total_requests,
          SUM(ru.response_time_ms)::bigint AS total_response_ms,
          ROUND(SUM(ru.response_time_ms) / 1000.0, 2) AS total_response_sec,
          COUNT(DISTINCT DATE(ru.created_at))::int AS active_days,
          MIN(ru.created_at) AS first_request,
          MAX(ru.created_at) AS last_request
       FROM request_usage ru
       JOIN users u ON u.id = ru.user_id
       WHERE ru.created_at >= $1 AND ru.created_at <= $2
       GROUP BY ru.user_id, u.first_name, u.last_name, u.username, u.email, ru.user_role
       ORDER BY total_response_ms DESC NULLS LAST`,
      [from, to]
    );

    const totalMs = rows.reduce((sum, r) => sum + Number(r.total_response_ms || 0), 0);
    const totalRequests = rows.reduce((sum, r) => sum + r.total_requests, 0);

    const users = rows.map((r) => ({
      ...r,
      pct_of_total_time: totalMs > 0 ? Math.round((Number(r.total_response_ms) / totalMs) * 10000) / 100 : 0,
      pct_of_total_requests: totalRequests > 0 ? Math.round((r.total_requests / totalRequests) * 10000) / 100 : 0,
    }));

    const studentCount = users.filter(u => u.user_role === 'student').length;
    const adminCount = users.filter(u => u.user_role === 'admin').length;
    const studentMs = users.filter(u => u.user_role === 'student').reduce((sum, r) => sum + Number(r.total_response_ms || 0), 0);
    const adminMs = users.filter(u => u.user_role === 'admin').reduce((sum, r) => sum + Number(r.total_response_ms || 0), 0);

    res.json({
      period: { from, to },
      totals: {
        user_count: rows.length,
        student_count: studentCount,
        admin_count: adminCount,
        total_requests: totalRequests,
        total_response_ms: totalMs,
        total_response_sec: Math.round(totalMs / 10) / 100,
        student_response_ms: studentMs,
        admin_response_ms: adminMs,
      },
      users,
    });
  } catch (err) {
    console.error("[usage] per-user error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/usage/summary
 * High-level usage summary.
 */
export const getUsageSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const from = req.query.from || startOfMonth;
    const rawTo = req.query.to || now.toISOString();
    const to = rawTo.length === 10 ? `${rawTo}T23:59:59.999Z` : rawTo;

    const [byRole, byPath, byDay] = await Promise.all([
      pool.query(
        `SELECT user_role, COUNT(*)::int AS requests, SUM(response_time_ms)::bigint AS total_ms
         FROM request_usage WHERE created_at >= $1 AND created_at <= $2
         GROUP BY user_role ORDER BY total_ms DESC`,
        [from, to]
      ),
      pool.query(
        `SELECT path, COUNT(*)::int AS requests, SUM(response_time_ms)::bigint AS total_ms,
                ROUND(AVG(response_time_ms))::int AS avg_ms
         FROM request_usage WHERE created_at >= $1 AND created_at <= $2
         GROUP BY path ORDER BY total_ms DESC LIMIT 20`,
        [from, to]
      ),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*)::int AS requests,
                COUNT(DISTINCT user_id)::int AS unique_users,
                SUM(response_time_ms)::bigint AS total_ms
         FROM request_usage WHERE created_at >= $1 AND created_at <= $2
         GROUP BY DATE(created_at) ORDER BY day`,
        [from, to]
      ),
    ]);

    res.json({
      period: { from, to },
      by_role: byRole.rows,
      top_endpoints: byPath.rows,
      by_day: byDay.rows,
    });
  } catch (err) {
    console.error("[usage] summary error:", err);
    res.status(500).json({ error: err.message });
  }
};
