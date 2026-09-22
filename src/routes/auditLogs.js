const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// GET /audit-logs?limit=20 - recent admin activity (Super Admin, Admin only)
router.get("/", requireRole("super_admin", "admin"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    const result = await db.query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
              u.name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load audit logs" });
  }
});

module.exports = router;