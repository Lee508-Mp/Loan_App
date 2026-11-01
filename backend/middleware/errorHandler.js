// MIDDLEWARE: the safety net. Unknown URLs get a clean 404. Crashes are logged on the server and the visitor
// only sees a generic message, so internal details (file paths, SQL) are never leaked.
exports.apiNotFound = (req, res) => res.status(404).json({ error: "Not found." });
exports.pageNotFound = (req, res) => res.status(404).type("text").send("Page not found.");

exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "The request body is not valid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "The request is too large." });
  console.error(err);
  if (req.originalUrl.startsWith("/api/")) return res.status(500).json({ error: "Something went wrong on the server." });
  res.status(500).type("text").send("Something went wrong.");
};
