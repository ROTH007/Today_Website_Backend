const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, image_url, category, category_km, website_url
       FROM trusted_clients WHERE is_visible = true ORDER BY category ASC, display_order ASC`,
    );
    res.json({ clients: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load clients" });
  }
});

// GET /trusted-clients/categories - existing category names, for the admin dropdown
router.get("/categories", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT category, category_km FROM trusted_clients ORDER BY category ASC`,
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM trusted_clients ORDER BY category ASC, display_order ASC`);
    res.json({ clients: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load clients" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { name, image_url, category, category_km, website_url } = req.body;

  if (!name || !image_url || !category) {
    return res.status(400).json({ error: "Name, image, and category are required" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM trusted_clients WHERE category = $1", [category]);

    const result = await db.query(
      `INSERT INTO trusted_clients (name, image_url, category, category_km, website_url, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, image_url, category, category_km || null, website_url || null, countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_client", "trusted_client", result.rows[0].id, { name, category });
    res.status(201).json({ client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create client" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { name, image_url, category, category_km, website_url } = req.body;

  if (!name || !image_url || !category) {
    return res.status(400).json({ error: "Name, image, and category are required" });
  }

  try {
    const result = await db.query(
      `UPDATE trusted_clients SET name = $1, image_url = $2, category = $3, category_km = $4, website_url = $5, updated_at = now()
       WHERE id = $6 RETURNING *`,
      [name, image_url, category, category_km || null, website_url || null, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Client not found" });
    await logAction(req.user.id, "update_client", "trusted_client", id, { name });
    res.json({ client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update client" });
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
      `UPDATE trusted_clients SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Client not found" });
    res.json({ client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM trusted_clients WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Client not found" });
    await logAction(req.user.id, "delete_client", "trusted_client", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete client" });
  }
});

module.exports = router;