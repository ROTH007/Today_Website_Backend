const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, description_en, description_km, image_url, year
       FROM company_awards WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ awards: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load awards" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM company_awards ORDER BY display_order ASC`);
    res.json({ awards: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load awards" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { title_en, title_km, description_en, description_km, image_url, year } = req.body;

  if (!title_en || !title_km || !image_url) {
    return res.status(400).json({ error: "Title (EN + KM) and an image are required" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM company_awards");

    const result = await db.query(
      `INSERT INTO company_awards (title_en, title_km, description_en, description_km, image_url, year, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title_en, title_km, description_en || null, description_km || null, image_url, year || null, countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_award", "company_award", result.rows[0].id, { title_en });
    res.status(201).json({ award: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create award" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { title_en, title_km, description_en, description_km, image_url, year } = req.body;

  if (!title_en || !title_km || !image_url) {
    return res.status(400).json({ error: "Title (EN + KM) and an image are required" });
  }

  try {
    const result = await db.query(
      `UPDATE company_awards SET title_en = $1, title_km = $2, description_en = $3, description_km = $4,
        image_url = $5, year = $6, updated_at = now()
       WHERE id = $7 RETURNING *`,
      [title_en, title_km, description_en || null, description_km || null, image_url, year || null, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Award not found" });
    await logAction(req.user.id, "update_award", "company_award", id, { title_en });
    res.json({ award: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update award" });
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
      `UPDATE company_awards SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Award not found" });
    res.json({ award: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM company_awards WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Award not found" });
    await logAction(req.user.id, "delete_award", "company_award", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete award" });
  }
});

module.exports = router;