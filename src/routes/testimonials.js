const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, role_en, role_km, quote_en, quote_km, avatar_url, rating, date_en, date_km
       FROM testimonials WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ testimonials: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load testimonials" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM testimonials ORDER BY display_order ASC`);
    res.json({ testimonials: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load testimonials" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { name, role_en, role_km, quote_en, quote_km, avatar_url, rating, date_en, date_km } = req.body;

  if (!name || !quote_km) {
    return res.status(400).json({ error: "Name and quote (Khmer) are required" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM testimonials");

    const result = await db.query(
      `INSERT INTO testimonials (name, role_en, role_km, quote_en, quote_km, avatar_url, rating, date_en, date_km, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, role_en || null, role_km || null, quote_en || null, quote_km, avatar_url || null, rating || 5, date_en || null, date_km || null, countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_testimonial", "testimonial", result.rows[0].id, { name });
    res.status(201).json({ testimonial: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create testimonial" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { name, role_en, role_km, quote_en, quote_km, avatar_url, rating, date_en, date_km } = req.body;

  if (!name || !quote_km) {
    return res.status(400).json({ error: "Name and quote (Khmer) are required" });
  }

  try {
    const result = await db.query(
      `UPDATE testimonials SET name = $1, role_en = $2, role_km = $3, quote_en = $4, quote_km = $5,
        avatar_url = $6, rating = $7, date_en = $8, date_km = $9, updated_at = now()
       WHERE id = $10 RETURNING *`,
      [name, role_en || null, role_km || null, quote_en || null, quote_km, avatar_url || null, rating || 5, date_en || null, date_km || null, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Testimonial not found" });
    await logAction(req.user.id, "update_testimonial", "testimonial", id, { name });
    res.json({ testimonial: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update testimonial" });
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
      `UPDATE testimonials SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Testimonial not found" });
    res.json({ testimonial: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM testimonials WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Testimonial not found" });
    await logAction(req.user.id, "delete_testimonial", "testimonial", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete testimonial" });
  }
});

module.exports = router;