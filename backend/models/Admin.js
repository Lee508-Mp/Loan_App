// MODEL: the admins table.
const db = require("./database");

const Admin = {
  findByUsername(username) {
    return db.prepare("SELECT * FROM admins WHERE username = ? COLLATE NOCASE").get(username); // Jane = jane
  },
  findById(id) {
    return db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
  },
  exists() {
    return Boolean(db.prepare("SELECT 1 AS found FROM admins LIMIT 1").get());
  },
  list() {
    return db.prepare("SELECT id, username, created_at FROM admins ORDER BY id").all(); // never includes password hashes
  },
  create(username, passwordHash) {
    const r = db.prepare("INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)")
      .run(username, passwordHash, new Date().toISOString());
    return Number(r.lastInsertRowid);
  },
  // Also bumps token_version, which ends every login that existed before the change.
  updatePassword(id, passwordHash) {
    return db.prepare("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?")
      .run(passwordHash, id).changes > 0;
  },
  remove(id) {
    return db.prepare("DELETE FROM admins WHERE id = ?").run(id).changes > 0;
  },
};

module.exports = Admin;
