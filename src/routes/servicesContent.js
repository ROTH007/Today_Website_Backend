const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

const VALID_ICONS = [
  "wifi", "building2", "server", "zap", "shieldcheck", "cable",
  "globe", "cloud", "database", "router", "satellite", "lock",
  "users", "headphones", "radio", "signal",
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name_en, name_km, description_en, description_km, icon, link_url
       FROM services_content WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ services: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load services" });
  }
});

router.get("/icons", authenticate, (req, res) => res.json({ icons: VALID_ICONS }));

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM services_content ORDER BY display_order ASC`);
    res.json({ services: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load services" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { name_en, name_km, description_en, description_km, icon, link_url } = req.body;

  if (!name_en || !name_km || !description_en || !description_km) {
    return res.status(400).json({ error: "Name and description are required in both languages" });
  }
  if (icon && !VALID_ICONS.includes(icon)) {
    return res.status(400).json({ error: "Invalid icon" });
  }

  try {
    let id = slugify(name_en);
    const existing = await db.query("SELECT id FROM services_content WHERE id = $1", [id]);
    if (existing.rows.length > 0) id = `${id}-${Date.now().toString(36)}`;

    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM services_content");

    const result = await db.query(
      `INSERT INTO services_content (id, name_en, name_km, description_en, description_km, icon, link_url, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name_en, name_km, description_en, description_km, icon || "wifi", link_url || "/contact", countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_service", "service", id, { name_en });
    res.status(201).json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create service" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { name_en, name_km, description_en, description_km, icon, link_url } = req.body;

  if (!name_en || !name_km || !description_en || !description_km) {
    return res.status(400).json({ error: "Name and description are required in both languages" });
  }
  if (icon && !VALID_ICONS.includes(icon)) {
    return res.status(400).json({ error: "Invalid icon" });
  }

  try {
    const result = await db.query(
      `UPDATE services_content SET name_en = $1, name_km = $2, description_en = $3, description_km = $4,
        icon = $5, link_url = $6, updated_by = $7, updated_at = now()
       WHERE id = $8 RETURNING *`,
      [name_en, name_km, description_en, description_km, icon || "wifi", link_url || "/contact", req.user.id, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, "update_service_content", "service", id, { name_en });
    res.json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update service" });
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
      `UPDATE services_content SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, is_visible ? "show_service" : "hide_service", "service", id, {});
    res.json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM services_content WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, "delete_service", "service", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete service" });
  }
});

module.exports = router;