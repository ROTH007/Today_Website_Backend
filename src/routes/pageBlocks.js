const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

// GET /page-blocks/public/:pageKey - visible blocks in order, for the live site
router.get("/public/:pageKey", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT block_key FROM page_blocks
       WHERE page_key = $1 AND is_visible = true
       ORDER BY display_order ASC`,
      [req.params.pageKey],
    );
    res.json({ order: result.rows.map((r) => r.block_key) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load page layout" });
  }
});

// GET /page-blocks/:pageKey - admin view, all blocks regardless of visibility
router.get("/:pageKey", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, block_key, label, display_order, is_visible
       FROM page_blocks WHERE page_key = $1 ORDER BY display_order ASC`,
      [req.params.pageKey],
    );
    res.json({ blocks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load page blocks" });
  }
});

// PUT /page-blocks/:pageKey - save new order + visibility for all blocks at once
router.put("/:pageKey", authenticate, requireRole("super_admin", "admin", "editor"), async (req, res) => {
  const { pageKey } = req.params;
  const { blocks } = req.body; // [{ block_key, display_order, is_visible }]

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ error: "blocks must be an array" });
  }

  try {
    for (const b of blocks) {
      await db.query(
        `UPDATE page_blocks SET display_order = $1, is_visible = $2, updated_by = $3, updated_at = now()
         WHERE page_key = $4 AND block_key = $5`,
        [b.display_order, b.is_visible, req.user.id, pageKey, b.block_key],
      );
    }
    await logAction(req.user.id, "reorder_page_blocks", "page_blocks", null, { page: pageKey });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save block order" });
  }
});

module.exports = router;