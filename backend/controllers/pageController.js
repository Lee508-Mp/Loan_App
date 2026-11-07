// CONTROLLER: hands the browser an HTML page (the "views" in frontend/views).
const path = require("path");
const view = (file) => path.join(__dirname, "..", "..", "frontend", "views", file);

exports.home = (req, res) => res.sendFile(view("index.html"));
exports.termsPage = (req, res) => res.sendFile(view("terms.html"));
// The customer's receipt page. The secret link is the only way in, so keep it out of search engines and caches.
exports.receiptPage = (req, res) => {
  res.set({ "X-Robots-Tag": "noindex", "Cache-Control": "no-store" });
  res.sendFile(view("receipt.html"));
};
exports.loginPage = (req, res) => res.sendFile(view("admin-login.html"));
exports.dashboardPage = (req, res) => res.sendFile(view("admin-dashboard.html")); // route is protected
