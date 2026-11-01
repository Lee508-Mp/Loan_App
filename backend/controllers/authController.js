// CONTROLLER: admin login and logout.
const env = require("../config/env");
const { checkLogin, signToken, TOKEN_LIFETIME_MS } = require("../services/authService");

// httpOnly: JavaScript in the page cannot read it. sameSite strict: other sites cannot make the browser send it.
const COOKIE = { httpOnly: true, sameSite: "strict", secure: env.isProd };

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  const admin = checkLogin(username, password);
  if (!admin) return res.status(401).json({ error: "Invalid username or password." });
  const token = signToken(admin);
  res.cookie("token", token, { ...COOKIE, maxAge: TOKEN_LIFETIME_MS });
  res.json({ username: admin.username, token }); // the token in the body is for Postman (Bearer auth)
};

exports.logout = (req, res) => { res.clearCookie("token", COOKIE); res.json({ ok: true }); };
exports.me = (req, res) => res.json({ username: req.admin.username });
