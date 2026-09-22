const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

// The pages available for content editing — matches the public site's nav.
const PAGES = [
  { key: "home", label: "Home" },
  { key: "business-solutions", label: "Business Solutions" },
  { key: "our-solution", label: "Our Solution" },
  { key: "blog", label: "Blog" },
  { key: "career", label: "Career" },
  { key: "about", label: "About Us" },
  { key: "contact", label: "Contact Us" },
];

const router = express.Router();

// GET /page-content/pages - the list of editable pages (for the admin grid)
router.get("/pages", authenticate, async (req, res) => {
  try {
    const counts = await db.query(
      `SELECT page_key, COUNT(*)::int AS block_count FROM page_content GROUP BY page_key`,
    );
    const countByKey = Object.fromEntries(counts.rows.map((r) => [r.page_key, r.block_count]));
    res.json({ pages: PAGES.map((p) => ({ ...p, blockCount: countByKey[p.key] || 0 })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load pages" });
  }
});

// GET /page-content/public/:pageKey - live values for the public website (no auth)
router.get("/public/:pageKey", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT block_key, value_en, value_km, image_url FROM page_content WHERE page_key = $1`,
      [req.params.pageKey],
    );
    const blocks = Object.fromEntries(
      result.rows.map((r) => [r.block_key, { en: r.value_en, km: r.value_km, image: r.image_url }]),
    );
    res.json({ blocks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load page content" });
  }
});

// GET /page-content/:pageKey - admin view (auth required)
router.get("/:pageKey", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, block_key, label, block_type, value_en, value_km, image_url, display_order, updated_at
       FROM page_content WHERE page_key = $1 ORDER BY display_order ASC`,
      [req.params.pageKey],
    );
    res.json({ blocks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load page content" });
  }
});

// PUT /page-content/:pageKey - save all blocks for a page at once
router.put("/:pageKey", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { pageKey } = req.params;
  const { blocks } = req.body; // [{ block_key, value_en, value_km, image_url }]

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ error: "blocks must be an array" });
  }

  try {
    for (const b of blocks) {
      await db.query(
        `UPDATE page_content
         SET value_en = $1, value_km = $2, image_url = $3, updated_by = $4, updated_at = now()
         WHERE page_key = $5 AND block_key = $6`,
        [b.value_en, b.value_km, b.image_url, req.user.id, pageKey, b.block_key],
      );
    }
    await logAction(req.user.id, "update_page_content", "page_content", null, { page: pageKey });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save page content" });
  }
});

module.exports = router;