const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../db/audit");

const router = express.Router();

const PUBLIC_FIELDS = "id, name, email, role, is_active, created_at, updated_at";

// All routes below require login. Only Super Admin and Admin can manage users.
router.use(authenticate);

// GET /users - list all admin users
router.get("/", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`,
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load users" });
  }
});

// POST /users - create a new admin user (Super Admin only)
router.post("/", requireRole("super_admin"), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (!["super_admin", "admin", "editor"].includes(role)) {
    return res.status(400).json({ error: "Role must be super_admin, admin, or editor" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_FIELDS}`,
      [name, email, passwordHash, role],
    );

    await logAction(req.user.id, "create_user", "user", result.rows[0].id, { email, role });
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A user with that email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create user" });
  }
});

// PUT /users/:id - edit name/email/role (Super Admin only)
router.put("/:id", requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  if (!["super_admin", "admin", "editor"].includes(role)) {
    return res.status(400).json({ error: "Role must be super_admin, admin, or editor" });
  }

  try {
    const result = await db.query(
      `UPDATE users SET name = $1, email = $2, role = $3, updated_at = now()
       WHERE id = $4
       RETURNING ${PUBLIC_FIELDS}`,
      [name, email, role, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAction(req.user.id, "update_user", "user", id, { name, email, role });
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A user with that email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update user" });
  }
});

// PATCH /users/:id/status - activate or deactivate (Super Admin only)
router.patch("/:id/status", requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "is_active must be true or false" });
  }
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: "You can't deactivate your own account" });
  }

  try {
    const result = await db.query(
      `UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
      [is_active, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAction(req.user.id, is_active ? "activate_user" : "deactivate_user", "user", id, {});
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update user status" });
  }
});

module.exports = router;
