// SERVICE: managing admin accounts. Every function returns { error, status } on a problem, or a result.
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { usernameError, passwordError } = require("../validators/adminValidator");

const hash = (password) => bcrypt.hashSync(password, 12);

function addAdmin(username, password) {
  const name = typeof username === "string" ? username.trim() : "";
  const errors = {};
  if (usernameError(name)) errors.username = usernameError(name);
  if (passwordError(password)) errors.password = passwordError(password);
  if (!errors.username && Admin.findByUsername(name)) errors.username = "That username is already taken.";
  if (Object.keys(errors).length) return { status: 400, error: Object.values(errors)[0], errors };
  return { id: Admin.create(name, hash(password)) };
}

// For the logged-in admin changing their OWN password. Needs the current password.
function changeOwnPassword(adminId, currentPassword, newPassword) {
  const admin = Admin.findById(adminId);
  if (typeof currentPassword !== "string" || !bcrypt.compareSync(currentPassword, admin.password_hash))
    return { status: 400, error: "Your current password is not correct." }; // 400, not 401, so the page does not log you out
  if (passwordError(newPassword)) return { status: 400, error: passwordError(newPassword) };
  if (newPassword === currentPassword) return { status: 400, error: "Choose a password you have not used just now." };
  Admin.updatePassword(adminId, hash(newPassword));
  return { ok: true };
}

// One admin setting a NEW password for a colleague (for example after they forgot theirs).
function resetPassword(targetId, selfId, newPassword) {
  if (Number(targetId) === selfId) return { status: 400, error: "Use \"Change my password\" for your own account." };
  if (!Admin.findById(targetId)) return { status: 404, error: "Admin not found." };
  if (passwordError(newPassword)) return { status: 400, error: passwordError(newPassword) };
  Admin.updatePassword(targetId, hash(newPassword));
  return { ok: true };
}

function removeAdmin(targetId, selfId) {
  if (Number(targetId) === selfId) return { status: 400, error: "You cannot delete your own account." };
  return Admin.remove(targetId) ? { ok: true } : { status: 404, error: "Admin not found." };
}

module.exports = { addAdmin, changeOwnPassword, resetPassword, removeAdmin };
