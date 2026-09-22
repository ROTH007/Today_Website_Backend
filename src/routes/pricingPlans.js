const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

const FIELDS = `
  id, badge_en, badge_km, name_en, name_km, price, period_en, period_km,
  features_en, features_km, cta_en, cta_km, display_order, is_visible,
  created_by, created_at, updated_at
`;

// ---------- PUBLIC ----------
router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, badge_en, badge_km, name_en, name_km, price, period_en, period_km,
              features_en, features_km, cta_en, cta_km
       FROM pricing_plans WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ plans: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load pricing plans" });
  }
});

// ---------- ADMIN ----------
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`SELECT ${FIELDS} FROM pricing_plans ORDER BY display_order ASC`);
    res.json({ plans: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load pricing plans" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`SELECT ${FIELDS} FROM pricing_plans WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load plan" });
  }
});

router.post("/", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const {
    badge_en, badge_km, name_en, name_km, price, period_en, period_km,
    features_en, features_km, cta_en, cta_km,
  } = req.body;

  if (!name_en || !name_km || !price) {
    return res.status(400).json({ error: "Name (both languages) and price are required" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM pricing_plans");
    const nextOrder = countResult.rows[0].count;

    const result = await db.query(
      `INSERT INTO pricing_plans
        (badge_en, badge_km, name_en, name_km, price, period_en, period_km, features_en, features_km, cta_en, cta_km, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${FIELDS}`,
      [
        badge_en, badge_km, name_en, name_km, price, period_en, period_km,
        JSON.stringify(features_en || []), JSON.stringify(features_km || []),
        cta_en, cta_km, nextOrder, req.user.id,
      ],
    );
    await logAction(req.user.id, "create_pricing_plan", "pricing_plan", result.rows[0].id, { name_en });
    res.status(201).json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create plan" });
  }
});

router.put("/:id", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const {
    badge_en, badge_km, name_en, name_km, price, period_en, period_km,
    features_en, features_km, cta_en, cta_km,
  } = req.body;

  if (!name_en || !name_km || !price) {
    return res.status(400).json({ error: "Name (both languages) and price are required" });
  }

  try {
    const result = await db.query(
      `UPDATE pricing_plans SET
        badge_en = $1, badge_km = $2, name_en = $3, name_km = $4, price = $5,
        period_en = $6, period_km = $7, features_en = $8, features_km = $9,
        cta_en = $10, cta_km = $11, updated_at = now()
       WHERE id = $12
       RETURNING ${FIELDS}`,
      [
        badge_en, badge_km, name_en, name_km, price, period_en, period_km,
        JSON.stringify(features_en || []), JSON.stringify(features_km || []),
        cta_en, cta_km, id,
      ],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
    await logAction(req.user.id, "update_pricing_plan", "pricing_plan", id, { name_en });
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update plan" });
  }
});

router.patch("/:id/visibility", requireRole("super_admin", "admin"), async (req, res) => {
  const { id } = req.params;
  const { is_visible } = req.body;

  if (typeof is_visible !== "boolean") {
    return res.status(400).json({ error: "is_visible must be true or false" });
  }

  try {
    const result = await db.query(
      `UPDATE pricing_plans SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING ${FIELDS}`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
    await logAction(req.user.id, is_visible ? "show_pricing_plan" : "hide_pricing_plan", "pricing_plan", id, {});
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update plan visibility" });
  }
});

// PUT /pricing-plans/reorder/all - save new order for all plans at once
router.put("/reorder/all", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { order } = req.body; // [{ id, display_order }]
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: "order must be an array" });
  }
  try {
    for (const item of order) {
      await db.query(`UPDATE pricing_plans SET display_order = $1 WHERE id = $2`, [item.display_order, item.id]);
    }
    await logAction(req.user.id, "reorder_pricing_plans", "pricing_plan", null, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save order" });
  }
});

router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM pricing_plans WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
    await logAction(req.user.id, "delete_pricing_plan", "pricing_plan", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete plan" });
  }
});

module.exports = router;