const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

// GET /province-coverage/public - for the live map (no auth)
router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, status, customers, speed, note FROM province_coverage`,
    );
    res.json({ provinces: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load coverage data" });
  }
});

// GET /province-coverage - admin list
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, status, customers, speed, note, updated_at
       FROM province_coverage ORDER BY name ASC`,
    );
    res.json({ provinces: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load coverage data" });
  }
});

// PUT /province-coverage/:id - update one province
router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { status, customers, speed, note } = req.body;

  if (!["covered", "coming-soon"].includes(status)) {
    return res.status(400).json({ error: "Status must be covered or coming-soon" });
  }

  try {
    const result = await db.query(
      `UPDATE province_coverage
       SET status = $1, customers = $2, speed = $3, note = $4, updated_by = $5, updated_at = now()
       WHERE id = $6
       RETURNING id, name, status, customers, speed, note, updated_at`,
      [status, customers || null, speed || null, note || null, req.user.id, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Province not found" });
    await logAction(req.user.id, "update_province_coverage", "province_coverage", null, { province: id, status });
    res.json({ province: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update province" });
  }
});

module.exports = router;