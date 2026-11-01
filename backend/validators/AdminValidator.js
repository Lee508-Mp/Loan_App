// VALIDATOR: rules for admin usernames and passwords. Each returns an error message, or null if it is fine.
const USERNAME_RE = /^[A-Za-z0-9._-]{3,40}$/;

exports.usernameError = (u) =>
  typeof u === "string" && USERNAME_RE.test(u.trim())
    ? null : "Username must be 3 to 40 characters: letters, numbers, dot, dash or underscore.";

// bcrypt only uses the first 72 characters, so longer passwords are refused rather than silently cut
exports.passwordError = (p) =>
  typeof p === "string" && p.length >= 10 && p.length <= 72 ? null : "Password must be 10 to 72 characters.";
