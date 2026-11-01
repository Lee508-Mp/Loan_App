// All settings come from the .env file (or Render's environment variables). Nothing secret lives in code.
require("dotenv").config({ quiet: true });
const e = process.env;

const env = {
  isProd: e.NODE_ENV === "production",
  port: Number(e.PORT) || 3000,
  jwtSecret: e.JWT_SECRET,
  dbPath: e.DB_PATH,                              // set this to a persistent disk path in production
  timezone: e.TIMEZONE || "Africa/Lusaka",        // "today" and due dates follow this timezone
  admin: { username: e.ADMIN_USERNAME, password: e.ADMIN_PASSWORD },
  mail: { host: e.SMTP_HOST, port: Number(e.SMTP_PORT) || 587, user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.MAIL_FROM, to: e.MAIL_TO },

  // Called once at startup. Refuses to run with a missing or weak secret.
  assertReady() {
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      console.error("Set JWT_SECRET (32+ characters) in your .env file. See .env.example.");
      process.exit(1);
    }
  },
};

module.exports = env;
