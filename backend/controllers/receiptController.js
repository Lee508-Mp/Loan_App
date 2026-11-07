// CONTROLLER (public): the customer's receipt. Anyone with the secret link can read it. No login.
const { findReceipt } = require("../services/receiptService");

exports.show = (req, res) => {
  const receipt = findReceipt(req.params.token);
  if (!receipt) return res.status(404).json({ error: "This receipt link is not valid." });
  res.set("Cache-Control", "no-store");
  res.json(receipt);
};
