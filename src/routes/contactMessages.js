const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /contact-messages - public, no auth. Called alongside Web3Forms
// (which still sends the actual email) so every submission also lands in
// our own database. No admin list page to view these yet -- that's the
// next step whenever it's wanted -- this just starts collecting the data.
router.post("/", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required" });
  }

  try {
    await db.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, phone || null, subject || null, message],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save message" });
  }
});

module.exports = router;