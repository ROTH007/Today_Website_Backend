const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { authenticate } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

// Blocks brute-force password guessing: after 10 failed/attempted logins
// from the same IP within 15 minutes, further attempts are rejected for
// the rest of that window. Successful logins don't count against the limit.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: "This account has been deactivated" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    await logAction(user.id, "login", "user", user.id, {});

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong logging in" });
  }
});

// Returns the full, up-to-date user row (not just the JWT payload) so a
// changed name, role, or avatar shows up without needing to log in again.
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, role, avatar_url, is_active FROM users WHERE id = $1",
      [req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load your account" });
  }
});

module.exports = router;