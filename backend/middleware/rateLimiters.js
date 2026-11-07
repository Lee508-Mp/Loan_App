// MIDDLEWARE: slows down abuse (password guessing, form spam). Limits are per IP address.
const rateLimit = require("express-rate-limit");

const limiter = (max, windowMinutes) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  });

module.exports = {
  loginLimiter: limiter(10, 15),   // 10 login attempts per 15 minutes
  submitLimiter: limiter(10, 15),  // 10 applications per 15 minutes
  termsLimiter: limiter(60, 1),    // the live calculator: 60 per minute
  receiptLimiter: limiter(30, 1),  // customers opening their receipt link: 30 per minute
};
