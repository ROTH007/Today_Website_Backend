const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

// Mirrors servicesContent.js exactly, but reads/writes
// residential_services_content -- a completely separate table from
// services_content (Business Solutions). No shared rows, no category
// field, no cross-table filtering anywhere.
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

// Detail-page text fields carried on every service row. Optional on
// write -- a service with no detail content yet just has these come back
// null/[] and the public site falls back to its default layout.
const DETAIL_FIELDS = [
  "detail_heading_en", "detail_heading_km",
  "detail_subtitle_lead_en", "detail_subtitle_lead_km",
  "detail_subtitle_en", "detail_subtitle_km",
  "detail_benefits_heading_en", "detail_benefits_heading_km",
  "detail_logo_url",
  "detail_packages_heading_en", "detail_packages_heading_km",
];

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, static_id, name_en, name_km, description_en, description_km, icon, link_url, image_url,
              detail_heading_en, detail_heading_km,
              detail_subtitle_lead_en, detail_subtitle_lead_km,
              detail_subtitle_en, detail_subtitle_km,
              detail_benefits_heading_en, detail_benefits_heading_km,
              detail_logo_url, detail_benefits,
              detail_packages_heading_en, detail_packages_heading_km, detail_packages
       FROM residential_services_content WHERE is_visible = true ORDER BY display_order ASC`,
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
    const result = await db.query(`SELECT * FROM residential_services_content ORDER BY display_order ASC`);
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
    const existing = await db.query("SELECT id FROM residential_services_content WHERE id = $1", [id]);
    if (existing.rows.length > 0) id = `${id}-${Date.now().toString(36)}`;

    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM residential_services_content");

    const result = await db.query(
      `INSERT INTO residential_services_content (id, name_en, name_km, description_en, description_km, icon, link_url, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name_en, name_km, description_en, description_km, icon || "wifi", link_url || "/contact", countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_residential_service", "residential_service", id, { name_en });
    res.status(201).json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create service" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { name_en, name_km, description_en, description_km, icon, link_url, image_url } = req.body;

  if (!name_en || !name_km || !description_en || !description_km) {
    return res.status(400).json({ error: "Name and description are required in both languages" });
  }
  if (icon && !VALID_ICONS.includes(icon)) {
    return res.status(400).json({ error: "Invalid icon" });
  }

  // Detail-page fields are all optional -- default to empty string/array
  // rather than null so the frontend never has to guard against null.
  const detail = {};
  for (const field of DETAIL_FIELDS) {
    detail[field] = req.body[field] ?? "";
  }
  const detailBenefits = Array.isArray(req.body.detail_benefits) ? req.body.detail_benefits : [];
  const detailPackages = Array.isArray(req.body.detail_packages) ? req.body.detail_packages : [];

  try {
    const result = await db.query(
      `UPDATE residential_services_content SET
        name_en = $1, name_km = $2, description_en = $3, description_km = $4,
        icon = $5, link_url = $6, image_url = $7, updated_by = $8, updated_at = now(),
        detail_heading_en = $9, detail_heading_km = $10,
        detail_subtitle_lead_en = $11, detail_subtitle_lead_km = $12,
        detail_subtitle_en = $13, detail_subtitle_km = $14,
        detail_benefits_heading_en = $15, detail_benefits_heading_km = $16,
        detail_logo_url = $17, detail_benefits = $18::jsonb,
        detail_packages_heading_en = $19, detail_packages_heading_km = $20,
        detail_packages = $21::jsonb
       WHERE id = $22 RETURNING *`,
      [
        name_en, name_km, description_en, description_km,
        icon || "wifi", link_url || "/contact", image_url || "", req.user.id,
        detail.detail_heading_en, detail.detail_heading_km,
        detail.detail_subtitle_lead_en, detail.detail_subtitle_lead_km,
        detail.detail_subtitle_en, detail.detail_subtitle_km,
        detail.detail_benefits_heading_en, detail.detail_benefits_heading_km,
        detail.detail_logo_url, JSON.stringify(detailBenefits),
        detail.detail_packages_heading_en, detail.detail_packages_heading_km,
        JSON.stringify(detailPackages),
        id,
      ],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, "update_residential_service_content", "residential_service", id, { name_en });
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
      `UPDATE residential_services_content SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, is_visible ? "show_residential_service" : "hide_residential_service", "residential_service", id, {});
    res.json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM residential_services_content WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Service not found" });
    await logAction(req.user.id, "delete_residential_service", "residential_service", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete service" });
  }
});

module.exports = router;