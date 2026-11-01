// CONTROLLER: admin login and logout.
const env = require("../config/env");
const { checkLogin, signToken, TOKEN_LIFETIME_MS } = require("../services/authService");

// httpOnly: JavaScript in the page cannot read it. sameSite strict: other sites cannot make the browser send it.
const COOKIE = { httpOnly: true, sameSite: "strict", secure: env.isProd };

// Sets the login cookie. Returns the token too, which is for Postman (Bearer auth).
function startSession(res, admin) {
  const token = signToken(admin);
  res.cookie("token", token, { ...COOKIE, maxAge: TOKEN_LIFETIME_MS });
  return token;
}
exports.startSession = startSession;

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  const admin = checkLogin(username, password);
  if (!admin) return res.status(401).json({ error: "Invalid username or password." });
  res.json({ username: admin.username, token: startSession(res, admin) });
};

exports.logout = (req, res) => { res.clearCookie("token", COOKIE); res.json({ ok: true }); };
exports.me = (req, res) => res.json({ id: req.admin.id, username: req.admin.username });
