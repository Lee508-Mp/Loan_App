// Passwords (bcrypt) and login tokens (JWT). Nothing else in the app touches bcrypt or jwt directly.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const Admin = require("../models/Admin");

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // admin sessions last 2 hours
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12); // keeps login timing similar for unknown users

// Creates the first admin from .env if there is none yet. The password is stored hashed, never as plain text.
function seedAdmin() {
  if (Admin.exists()) return;
  const { username, password } = env.admin;
  if (username && password && password.length >= 10) {
    Admin.create(username, bcrypt.hashSync(password, 12));
    console.log(`Admin "${username}" created. You can now remove ADMIN_PASSWORD from .env.`);
  } else {
    console.warn("No admin exists. Set ADMIN_USERNAME and ADMIN_PASSWORD (10+ chars) in .env and restart.");
  }
}

// Returns the admin row if the username and password are right, otherwise null.
function checkLogin(username, password) {
  const admin = typeof username === "string" ? Admin.findByUsername(username) : null;
  const ok = bcrypt.compareSync(typeof password === "string" ? password : "", admin ? admin.password_hash : DUMMY_HASH);
  return admin && ok ? admin : null;
}

const signToken = (admin) =>
  jwt.sign({ id: admin.id, username: admin.username }, env.jwtSecret, { algorithm: "HS256", expiresIn: TOKEN_LIFETIME_MS / 1000 });

const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });

function tokenFromRequest(req) {
  const h = req.headers.authorization || "";
  return req.cookies.token || (h.startsWith("Bearer ") ? h.slice(7) : null);
}

module.exports = { TOKEN_LIFETIME_MS, seedAdmin, checkLogin, signToken, verifyToken, tokenFromRequest };
