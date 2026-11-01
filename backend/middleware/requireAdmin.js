// MIDDLEWARE: the login check. Two flavours: the API answers 401 JSON, pages redirect to the login page.
const { verifyToken, tokenFromRequest } = require("../services/authService");
const Admin = require("../models/Admin");

function authenticate(req, res, next, onFail) {
  try {
    const payload = verifyToken(tokenFromRequest(req));
    const admin = Admin.findById(payload.id);
    // A deleted admin, or a login from before a password change, stops working straight away
    if (!admin || admin.token_version !== payload.tv) throw new Error("session no longer valid");
    req.admin = { id: admin.id, username: admin.username };
    res.set("Cache-Control", "no-store"); // never let a browser or proxy cache admin data
    next();
  } catch {
    onFail();
  }
}

exports.requireAdminApi = (req, res, next) =>
  authenticate(req, res, next, () => res.status(401).json({ error: "Not logged in." }));

exports.requireAdminPage = (req, res, next) =>
  authenticate(req, res, next, () => res.redirect("/admin/login"));
