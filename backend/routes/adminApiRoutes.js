// ROUTES: the admin API, mounted at /api/admin. Login/logout are open; everything below requireAdminApi needs a login.
const router = require("express").Router();
const auth = require("../controllers/authController");
const admin = require("../controllers/adminController");
const accounts = require("../controllers/adminAccountController");
const messages = require("../controllers/messageController");
const { requireAdminApi } = require("../middleware/requireAdmin");
const { loginLimiter } = require("../middleware/rateLimiters");

router.post("/login", loginLimiter, auth.login);
router.post("/logout", auth.logout);

router.use(requireAdminApi);
router.get("/me", auth.me);
router.post("/change-password", accounts.changeOwnPassword);
router.get("/admins", accounts.list);
router.post("/admins", accounts.create);
router.put("/admins/:id/password", accounts.resetPassword);
router.delete("/admins/:id", accounts.remove);
router.get("/alerts", admin.alerts);
router.get("/applications", admin.list);
router.get("/applications/:id", admin.get);
router.put("/applications/:id", admin.update);
router.post("/applications/:id/collateral-received", admin.collateral);
router.post("/applications/:id/money-given", admin.moneyGiven);
router.post("/applications/:id/repayment", admin.repayment);
router.post("/applications/:id/cancel", admin.cancel);
router.get("/applications/:id/message", messages.draft);
router.post("/applications/:id/messages", messages.send);
router.delete("/applications/:id", admin.remove);

module.exports = router;
