const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(requireRole("super_admin", "admin"));

// GET /audit-logs/filters - the real users/actions/resources that have
// actually appeared in the log, so the filter dropdowns never show an
// option with zero matching rows.
router.get("/filters", async (req, res) => {
  try {
    const [users, actions, resources] = await Promise.all([
      db.query(
        `SELECT DISTINCT u.id, u.name
         FROM audit_logs al JOIN users u ON u.id = al.user_id
         ORDER BY u.name`,
      ),
      db.query(`SELECT DISTINCT action FROM audit_logs ORDER BY action`),
      db.query(
        `SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type`,
      ),
    ]);
    res.json({
      users: users.rows,
      actions: actions.rows.map((r) => r.action),
      resources: resources.rows.map((r) => r.entity_type),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load filter options" });
  }
});

// GET /audit-logs?start_date=&end_date=&user_id=&action=&resource=&limit=&offset=
// Supports the same call your dashboard already makes (?limit=200, no
// filters) as well as the fully filtered, paginated call the Audit Logs
// page makes.
router.get("/", async (req, res) => {
  const { start_date, end_date, user_id, action, resource } = req.query;
  const limit = Math.min(Number(req.query.limit) || 8, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];
  let i = 1;

  if (start_date) {
    conditions.push(`al.created_at >= $${i++}`);
    params.push(start_date);
  }
  if (end_date) {
    conditions.push(`al.created_at < ($${i++}::date + interval '1 day')`);
    params.push(end_date);
  }
  if (user_id) {
    conditions.push(`al.user_id = $${i++}`);
    params.push(user_id);
  }
  if (action) {
    conditions.push(`al.action = $${i++}`);
    params.push(action);
  }
  if (resource) {
    conditions.push(`al.entity_type = $${i++}`);
    params.push(resource);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs al ${where}`,
      params,
    );

    const logsResult = await db.query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
              u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
    );

    const latestResult = await db.query(`SELECT MAX(created_at) AS latest FROM audit_logs`);

    res.json({
      logs: logsResult.rows,
      total: countResult.rows[0].count,
      latestLogAt: latestResult.rows[0].latest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load audit logs" });
  }
});

module.exports = router;