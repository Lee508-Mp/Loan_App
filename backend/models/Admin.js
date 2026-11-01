// MODEL: the admins table.
const db = require("./database");

const Admin = {
  findByUsername(username) {
    return db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  },
  exists() {
    return Boolean(db.prepare("SELECT 1 AS found FROM admins LIMIT 1").get());
  },
  create(username, passwordHash) {
    db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(username, passwordHash);
  },
};

module.exports = Admin;
