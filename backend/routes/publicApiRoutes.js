// ROUTES: the API anyone can call (no login).
const router = require("express").Router();
const applications = require("../controllers/applicationController");
const receipts = require("../controllers/receiptController");
const { submitLimiter, termsLimiter, receiptLimiter } = require("../middleware/rateLimiters");

router.get("/loan-terms", termsLimiter, applications.getTerms);
router.post("/applications", submitLimiter, applications.submit);
router.get("/receipts/:token", receiptLimiter, receipts.show);

module.exports = router;
