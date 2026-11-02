// CONTROLLER (admin): who can log in. All routes need a login.
const Admin = require("../models/Admin");
const accounts = require("../services/adminAccountService");
const { startSession } = require("./authController");

const reply = (res, result, okStatus = 200, okBody = { ok: true }) =>
  result.error ? res.status(result.status).json({ error: result.error, errors: result.errors }) : res.status(okStatus).json(okBody);

exports.list = (req, res) => res.json(Admin.list());

exports.create = (req, res) => {
  const r = accounts.addAdmin(req.body?.username, req.body?.password);
  reply(res, r, 201, { id: r.id });
};

exports.changeOwnPassword = (req, res) => {
  const r = accounts.changeOwnPassword(req.admin.id, req.body?.currentPassword, req.body?.newPassword);
  if (r.error) return reply(res, r);
  // The change ended all older logins, so give THIS browser a fresh one and keep the admin signed in
  const token = startSession(res, Admin.findById(req.admin.id));
  res.json({ ok: true, token });
};

exports.resetPassword = (req, res) => reply(res, accounts.resetPassword(req.params.id, req.admin.id, req.body?.newPassword));
exports.remove = (req, res) => reply(res, accounts.removeAdmin(req.params.id, req.admin.id));
