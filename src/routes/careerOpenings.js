const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, department_en, department_km
       FROM career_openings WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ openings: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load openings" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM career_openings ORDER BY display_order ASC`);
    res.json({ openings: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load openings" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { title_en, title_km, department_en, department_km } = req.body;

  if (!title_en || !title_km) {
    return res.status(400).json({ error: "Title is required in both languages" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM career_openings");
    const result = await db.query(
      `INSERT INTO career_openings (title_en, title_km, department_en, department_km, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title_en, title_km, department_en || null, department_km || null, countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_opening", "career_opening", result.rows[0].id, { title_en });
    res.status(201).json({ opening: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create opening" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { title_en, title_km, department_en, department_km } = req.body;

  if (!title_en || !title_km) {
    return res.status(400).json({ error: "Title is required in both languages" });
  }

  try {
    const result = await db.query(
      `UPDATE career_openings SET title_en = $1, title_km = $2, department_en = $3, department_km = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [title_en, title_km, department_en || null, department_km || null, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Opening not found" });
    await logAction(req.user.id, "update_opening", "career_opening", id, { title_en });
    res.json({ opening: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update opening" });
  }
});

router.patch("/:id/visibility", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  const { id } = req.params;
  const { is_visible } = req.body;

  if (typeof is_visible !== "boolean") {
    return res.status(400).json({ error: "is_visible must be true or false" });
  }

  try {
    const result = await db.query(
      `UPDATE career_openings SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Opening not found" });
    res.json({ opening: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM career_openings WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Opening not found" });
    await logAction(req.user.id, "delete_opening", "career_opening", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete opening" });
  }
});

module.exports = router;