// The database connection, the table definitions and upgrades. Uses SQLite built into Node.js (node:sqlite),
// so nothing needs compiling on Windows. Needs Node 22.13+. The "ExperimentalWarning" it prints is harmless.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const env = require("../config/env");
const { calculateLoan, createdDate } = require("../services/loanCalculator");

const db = new DatabaseSync(env.dbPath || path.join(__dirname, "..", "..", "loans.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    phone      TEXT    NOT NULL,
    amount     INTEGER NOT NULL,
    period     TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'new',
    notes      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
`);

// Upgrades for the admins table. token_version goes up whenever a password changes, which ends older logins.
const adminCols = db.prepare("PRAGMA table_info(admins)").all().map((c) => c.name);
if (!adminCols.includes("token_version")) db.exec("ALTER TABLE admins ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0");
if (!adminCols.includes("created_at")) db.exec("ALTER TABLE admins ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");

// Upgrades: add columns that older databases don't have yet
const cols = db.prepare("PRAGMA table_info(applications)").all().map((c) => c.name);
const addCol = (name, def) => { if (!cols.includes(name)) db.exec(`ALTER TABLE applications ADD COLUMN ${name} ${def}`); };
addCol("contact_method", "TEXT NOT NULL DEFAULT 'whatsapp'");
addCol("email", "TEXT NOT NULL DEFAULT ''");
addCol("interest_rate", "REAL NOT NULL DEFAULT 0");
addCol("interest_amount", "REAL NOT NULL DEFAULT 0");
addCol("total_repayment", "REAL NOT NULL DEFAULT 0");
addCol("due_date", "TEXT NOT NULL DEFAULT ''");        // YYYY-MM-DD
addCol("collateral_type", "TEXT NOT NULL DEFAULT ''");
addCol("collateral_details", "TEXT NOT NULL DEFAULT ''");
addCol("terms_accepted_at", "TEXT NOT NULL DEFAULT ''"); // when the applicant accepted the Terms and Conditions (UTC)
addCol("terms_version", "TEXT NOT NULL DEFAULT ''");
addCol("approved_at", "TEXT NOT NULL DEFAULT ''");     // YYYY-MM-DD, set when the loan is approved

// Fill in the loan columns for applications saved before they existed
const fill = db.prepare("UPDATE applications SET interest_rate=?, interest_amount=?, total_repayment=?, due_date=? WHERE id=?");
for (const r of db.prepare("SELECT id, amount, period, created_at FROM applications WHERE due_date = ''").all()) {
  const c = calculateLoan(r.amount, r.period, createdDate(r));
  if (c) fill.run(c.interestRate, c.interestAmount, c.totalRepayment, c.dueDate, r.id);
}

module.exports = db;
