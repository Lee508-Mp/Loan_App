// ROUTES: the admin API, mounted at /api/admin. Login/logout are open; everything below requireAdminApi needs a login.
const router = require("express").Router();
const auth = require("../controllers/authController");
const admin = require("../controllers/adminController");
const { requireAdminApi } = require("../middleware/requireAdmin");
const { loginLimiter } = require("../middleware/rateLimiters");

router.post("/login", loginLimiter, auth.login);
router.post("/logout", auth.logout);

router.use(requireAdminApi);
router.get("/me", auth.me);
router.get("/alerts", admin.alerts);
router.get("/applications", admin.list);
router.get("/applications/:id", admin.get);
router.put("/applications/:id", admin.update);
router.delete("/applications/:id", admin.remove);

module.exports = router;
