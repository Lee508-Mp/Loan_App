// Entry point: checks settings, creates the first admin, starts listening. Run with `npm start` or `npm run dev`.
const env = require("./config/env");
env.assertReady(); // stops here if JWT_SECRET is missing or weak

const { seedAdmin } = require("./services/authService");
const app = require("./app");

seedAdmin();
app.listen(env.port, () => console.log(`Running at http://localhost:${env.port}`));
