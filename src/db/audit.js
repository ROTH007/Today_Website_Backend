const db = require("../db");

async function logAction(userId, action, entityType, entityId, details = {}) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, JSON.stringify(details)],
    );
  } catch (err) {
    // Never let a logging failure break the actual request.
    console.error("Failed to write audit log:", err.message);
  }
}

module.exports = { logAction };
