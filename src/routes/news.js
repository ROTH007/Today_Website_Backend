const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

const ADMIN_FIELDS = `
  id, title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km,
  body_en, body_km, image_url, status, published_at, created_by, created_at, updated_at
`;

// ---------- PUBLIC (no auth) — used by the public website ----------

// GET /news/public - list only published articles, newest first
router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, image_url, published_at
       FROM news_articles
       WHERE status = 'published'
       ORDER BY published_at DESC`,
    );
    res.json({ articles: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load articles" });
  }
});

// GET /news/public/:id - a single published article
router.get("/public/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km,
              body_en, body_km, image_url, published_at
       FROM news_articles
       WHERE id = $1 AND status = 'published'`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load article" });
  }
});

// ---------- ADMIN (auth required) ----------
router.use(authenticate);

// GET /news - list ALL articles regardless of status (admin table view)
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${ADMIN_FIELDS} FROM news_articles ORDER BY created_at DESC`,
    );
    res.json({ articles: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load articles" });
  }
});

// GET /news/:id - single article for editing
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${ADMIN_FIELDS} FROM news_articles WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load article" });
  }
});

// POST /news - create (Super Admin, Admin, Editor can all create)
router.post("/", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, body_en, body_km, image_url } = req.body;

  if (!title_en || !title_km || !excerpt_en || !excerpt_km || !body_en || !body_km) {
    return res.status(400).json({ error: "Title, excerpt, and body are required in both languages" });
  }

  try {
    const result = await db.query(
      `INSERT INTO news_articles
        (title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, body_en, body_km, image_url, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
       RETURNING ${ADMIN_FIELDS}`,
      [title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, body_en, body_km, image_url, req.user.id],
    );
    await logAction(req.user.id, "create_article", "news_article", result.rows[0].id, { title_en });
    res.status(201).json({ article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create article" });
  }
});

// PUT /news/:id - update
router.put("/:id", requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, body_en, body_km, image_url } = req.body;

  if (!title_en || !title_km || !excerpt_en || !excerpt_km || !body_en || !body_km) {
    return res.status(400).json({ error: "Title, excerpt, and body are required in both languages" });
  }

  try {
    const result = await db.query(
      `UPDATE news_articles SET
        title_en = $1, title_km = $2, caption_en = $3, caption_km = $4,
        excerpt_en = $5, excerpt_km = $6, body_en = $7, body_km = $8, image_url = $9,
        updated_at = now()
       WHERE id = $10
       RETURNING ${ADMIN_FIELDS}`,
      [title_en, title_km, caption_en, caption_km, excerpt_en, excerpt_km, body_en, body_km, image_url, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    await logAction(req.user.id, "update_article", "news_article", id, { title_en });
    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update article" });
  }
});

// PATCH /news/:id/status - publish or unpublish (Super Admin, Admin only)
router.patch("/:id/status", requireRole("super_admin", "admin"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["draft", "published"].includes(status)) {
    return res.status(400).json({ error: "Status must be draft or published" });
  }

  try {
    const publishedAtClause = status === "published" ? "now()" : "NULL";
    const result = await db.query(
      `UPDATE news_articles SET status = $1, published_at = ${publishedAtClause}, updated_at = now()
       WHERE id = $2
       RETURNING ${ADMIN_FIELDS}`,
      [status, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    await logAction(req.user.id, status === "published" ? "publish_article" : "unpublish_article", "news_article", id, {});
    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update article status" });
  }
});

// DELETE /news/:id - (Super Admin, Admin only)
router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM news_articles WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    await logAction(req.user.id, "delete_article", "news_article", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete article" });
  }
});

module.exports = router;