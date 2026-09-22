const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

const ADMIN_FIELDS = `
  id, title_en, title_km, description_en, description_km, location_en, location_km,
  image_url, event_date, status, published_at, created_by, created_at, updated_at
`;

// ---------- PUBLIC (no auth) ----------

// GET /events/public - published events, soonest first
router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date
       FROM events
       WHERE status = 'published'
       ORDER BY event_date ASC`,
    );
    res.json({ events: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load events" });
  }
});

router.get("/public/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date
       FROM events WHERE id = $1 AND status = 'published'`,
      [req.params.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load event" });
  }
});

// ---------- ADMIN ----------
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`SELECT ${ADMIN_FIELDS} FROM events ORDER BY created_at DESC`);
    res.json({ events: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load events" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`SELECT ${ADMIN_FIELDS} FROM events WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load event" });
  }
});

router.post("/", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date } = req.body;

  if (!title_en || !title_km || !description_en || !description_km || !event_date) {
    return res.status(400).json({ error: "Title, description, and date are required in both languages" });
  }

  try {
    const result = await db.query(
      `INSERT INTO events
        (title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
       RETURNING ${ADMIN_FIELDS}`,
      [title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date, req.user.id],
    );
    await logAction(req.user.id, "create_event", "event", result.rows[0].id, { title_en });
    res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create event" });
  }
});

router.put("/:id", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date } = req.body;

  if (!title_en || !title_km || !description_en || !description_km || !event_date) {
    return res.status(400).json({ error: "Title, description, and date are required in both languages" });
  }

  try {
    const result = await db.query(
      `UPDATE events SET
        title_en = $1, title_km = $2, description_en = $3, description_km = $4,
        location_en = $5, location_km = $6, image_url = $7, event_date = $8, updated_at = now()
       WHERE id = $9
       RETURNING ${ADMIN_FIELDS}`,
      [title_en, title_km, description_en, description_km, location_en, location_km, image_url, event_date, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    await logAction(req.user.id, "update_event", "event", id, { title_en });
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update event" });
  }
});

router.patch("/:id/status", requireRole("super_admin", "admin"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["draft", "published"].includes(status)) {
    return res.status(400).json({ error: "Status must be draft or published" });
  }

  try {
    const publishedAtClause = status === "published" ? "now()" : "NULL";
    const result = await db.query(
      `UPDATE events SET status = $1, published_at = ${publishedAtClause}, updated_at = now()
       WHERE id = $2 RETURNING ${ADMIN_FIELDS}`,
      [status, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    await logAction(req.user.id, status === "published" ? "publish_event" : "unpublish_event", "event", id, {});
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update event status" });
  }
});

router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM events WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    await logAction(req.user.id, "delete_event", "event", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete event" });
  }
});

module.exports = router;