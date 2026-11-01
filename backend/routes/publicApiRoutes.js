// ROUTES: the API anyone can call (no login).
const router = require("express").Router();
const applications = require("../controllers/applicationController");
const { submitLimiter, termsLimiter } = require("../middleware/rateLimiters");

router.get("/loan-terms", termsLimiter, applications.getTerms);
router.post("/applications", submitLimiter, applications.submit);

module.exports = router;
