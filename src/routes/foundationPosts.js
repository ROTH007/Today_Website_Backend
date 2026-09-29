const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

router.get("/public", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, caption_en, caption_km, post_date, images
       FROM foundation_posts WHERE is_visible = true ORDER BY display_order ASC`,
    );
    res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load posts" });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM foundation_posts ORDER BY display_order ASC`);
    res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load posts" });
  }
});

router.post("/", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { caption_en, caption_km, post_date, images } = req.body;
  const photoList = Array.isArray(images) ? images : [];

  if (!caption_en || !caption_km || photoList.length === 0) {
    return res.status(400).json({ error: "Caption (EN + KM) and at least one photo are required" });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM foundation_posts");

    const result = await db.query(
      `INSERT INTO foundation_posts (caption_en, caption_km, post_date, images, display_order, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
      [caption_en, caption_km, post_date || null, JSON.stringify(photoList), countResult.rows[0].count, req.user.id],
    );
    await logAction(req.user.id, "create_foundation_post", "foundation_post", result.rows[0].id, {});
    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create post" });
  }
});

router.put("/:id", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { id } = req.params;
  const { caption_en, caption_km, post_date, images } = req.body;
  const photoList = Array.isArray(images) ? images : [];

  if (!caption_en || !caption_km || photoList.length === 0) {
    return res.status(400).json({ error: "Caption (EN + KM) and at least one photo are required" });
  }

  try {
    const result = await db.query(
      `UPDATE foundation_posts SET caption_en = $1, caption_km = $2, post_date = $3,
        images = $4::jsonb, updated_by = $5, updated_at = now()
       WHERE id = $6 RETURNING *`,
      [caption_en, caption_km, post_date || null, JSON.stringify(photoList), req.user.id, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    await logAction(req.user.id, "update_foundation_post", "foundation_post", id, {});
    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update post" });
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
      `UPDATE foundation_posts SET is_visible = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_visible, id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update visibility" });
  }
});

router.delete("/:id", authenticate, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM foundation_posts WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    await logAction(req.user.id, "delete_foundation_post", "foundation_post", req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete post" });
  }
});

module.exports = router;