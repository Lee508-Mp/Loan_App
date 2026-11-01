// Builds the Express app: security settings, then routes. server.js starts it; the tests import it.
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const publicApiRoutes = require("./routes/publicApiRoutes");
const adminApiRoutes = require("./routes/adminApiRoutes");
const pageRoutes = require("./routes/pageRoutes");
const { apiNotFound, pageNotFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1); // behind Render's proxy, so rate limits see the visitor's real IP
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { "upgrade-insecure-requests": null } } }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/assets", express.static(path.join(__dirname, "..", "frontend", "assets"))); // css and js for the pages
app.use("/api", publicApiRoutes);
app.use("/api/admin", adminApiRoutes);
app.use("/api", apiNotFound);
app.use(pageRoutes);
app.use(pageNotFound);
app.use(errorHandler);

module.exports = app;
