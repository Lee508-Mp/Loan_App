// ROUTES: which URL shows which page.
const router = require("express").Router();
const pages = require("../controllers/pageController");
const { requireAdminPage } = require("../middleware/requireAdmin");

router.get("/", pages.home);
router.get("/terms", pages.termsPage);
router.get("/admin/login", pages.loginPage);
router.get("/admin/login.html", (req, res) => res.redirect("/admin/login")); // old address
router.get("/admin", requireAdminPage, pages.dashboardPage);

module.exports = router;
