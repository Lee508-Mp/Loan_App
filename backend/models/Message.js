// MODEL: the log of messages the admins have sent to customers.
const db = require("./database");

const Message = {
  create({ applicationId, kind, body, adminUsername }) {
    db.prepare("INSERT INTO messages (application_id, kind, body, admin_username, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(applicationId, kind, body, adminUsername, new Date().toISOString());
  },
  listFor(applicationId) {
    return db.prepare("SELECT kind, admin_username, created_at FROM messages WHERE application_id = ? ORDER BY id DESC LIMIT 10")
      .all(applicationId);
  },
};

module.exports = Message;
