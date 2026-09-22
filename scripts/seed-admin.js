// Run once to create the first Super Admin account.
// Usage: node scripts/seed-admin.js "Your Name" you@today.com.kh yourpassword
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/db");

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Usage: node scripts/seed-admin.js "Your Name" you@today.com.kh yourpassword');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, name, email, role`,
      [name, email, passwordHash],
    );
    console.log("Super Admin ready:", result.rows[0]);
  } catch (err) {
    console.error("Failed to seed admin:", err.message);
  } finally {
    await db.pool.end();
  }
}

main();
