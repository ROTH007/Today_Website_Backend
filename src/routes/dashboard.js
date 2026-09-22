const express = require("express");
const db = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// GET /dashboard/stats - counts for the overview cards
router.get("/stats", async (req, res) => {
  try {
    const [users, published, drafts, actions] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS count FROM users WHERE is_active = true"),
      db.query("SELECT COUNT(*)::int AS count FROM news_articles WHERE status = 'published'"),
      db.query("SELECT COUNT(*)::int AS count FROM news_articles WHERE status = 'draft'"),
      db.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE created_at > now() - interval '7 days'"),
    ]);

    res.json({
      activeUsers: users.rows[0].count,
      publishedArticles: published.rows[0].count,
      draftArticles: drafts.rows[0].count,
      recentActions: actions.rows[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard stats" });
  }
});

module.exports = router;