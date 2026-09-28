const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

// ---------- PUBLIC (no auth) ----------
router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, icon, label_en, label_km, value_en, value_km, link
       FROM contact_info
       WHERE is_visible = true
       ORDER BY display_order ASC`,
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load contact info" });
  }
});

// ---------- ADMIN (auth required) ----------
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM contact_info ORDER BY display_order ASC`,
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load contact info" });
  }
});

router.post("/", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { icon, label_en, label_km, value_en, value_km, link, display_order } = req.body;

  if (!label_en || !value_en) {
    return res.status(400).json({ error: "Label and value are required" });
  }

  try {
    const result = await db.query(
      `INSERT INTO contact_info (icon, label_en, label_km, value_en, value_km, link, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [icon || "map-pin", label_en, label_km, value_en, value_km, link, display_order || 0, req.user.id],
    );
    await logAction(req.user.id, "create_contact_info", "contact_info", result.rows[0].id, { label_en });
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create item" });
  }
});

router.put("/:id", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { icon, label_en, label_km, value_en, value_km, link, display_order } = req.body;

  if (!label_en || !value_en) {
    return res.status(400).json({ error: "Label and value are required" });
  }

  try {
    const result = await db.query(
      `UPDATE contact_info SET
        icon = $1, label_en = $2, label_km = $3, value_en = $4, value_km = $5,
        link = $6, display_order = $7, updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [icon || "map-pin", label_en, label_km, value_en, value_km, link, display_order || 0, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    await logAction(req.user.id, "update_contact_info", "contact_info", id, { label_en });
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update item" });
  }
});

router.patch("/:id/visibility", requireRole("super_admin", "admin"), async (req, res) => {
  const { id } = req.params;
  const { is_visible } = req.body;

  try {
    const result = await db.query(
      `UPDATE contact_info SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM contact_info WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    await logAction(req.user.id, "delete_contact_info", "contact_info", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete item" });
  }
});

module.exports = router;