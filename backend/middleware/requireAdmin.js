// MIDDLEWARE: the login check. Two flavours: the API answers 401 JSON, pages redirect to the login page.
const { verifyToken, tokenFromRequest } = require("../services/authService");

function authenticate(req, res, next, onFail) {
  try {
    req.admin = verifyToken(tokenFromRequest(req));
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
