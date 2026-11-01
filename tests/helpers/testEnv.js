// Must be required FIRST in a test file. Gives the tests their own settings and a throwaway database,
// so running `npm test` can never touch your real loans.db or send real emails.
const fs = require("fs");
const os = require("os");
const path = require("path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loan-test-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "t".repeat(48),
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "TestPass12345",
  DB_PATH: path.join(dir, "test.db"),
  SMTP_HOST: "", MAIL_TO: "", // blank = email off (dotenv never overrides values that are already set)
});
module.exports = { dir };
