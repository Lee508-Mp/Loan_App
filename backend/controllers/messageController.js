// CONTROLLER (admin): the message window. Draft a message, then log it and hand back the WhatsApp link.
const env = require("../config/env");
const Application = require("../models/Application");
const messages = require("../services/messageService");

const baseUrl = (req) => env.publicUrl || `${req.protocol}://${req.get("host")}`;
const fail = (res, r) => res.status(r.status).json({ error: r.error });

exports.draft = (req, res) => {
  const row = Application.findById(req.params.id);
  if (!row) return res.status(404).json({ error: "Application not found." });
  const r = messages.buildDraft(row, req.query.kind, baseUrl(req));
  r.error ? fail(res, r) : res.json(r);
};

exports.send = (req, res) => {
  const row = Application.findById(req.params.id);
  if (!row) return res.status(404).json({ error: "Application not found." });
  const r = messages.recordMessage(row, req.body?.kind, req.body?.text, req.admin.username);
  r.error ? fail(res, r) : res.status(201).json({ url: r.url });
};
