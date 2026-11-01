// Saves a copy of the database to backups/loans-<date-time>.db. Safe to run while the app is running.
//   npm run backup
const fs = require("fs");
const path = require("path");
const db = require("../backend/models/database");

const dir = path.join(__dirname, "..", "backups");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const file = path.join(dir, `loans-${stamp}.db`);
db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); // SQLite writes a consistent, compact copy
console.log("Backup saved:", file);
