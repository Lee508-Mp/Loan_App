// Emergency tool: creates an admin, or sets a new password for an existing one. Works on the database in this folder
// (or DB_PATH). On Render this needs the Shell, which is a paid-plan feature.
//   npm run admin -- <username> <new-password>
const bcrypt = require("bcryptjs");
const Admin = require("../backend/models/Admin");
const { usernameError, passwordError } = require("../backend/validators/adminValidator");

const [username, password] = process.argv.slice(2);
const problem = usernameError(username) || passwordError(password);
if (problem) { console.error(problem + "\nUsage: npm run admin -- <username> <new-password>"); process.exit(1); }

const hash = bcrypt.hashSync(password, 12);
const existing = Admin.findByUsername(username);
if (existing) { Admin.updatePassword(existing.id, hash); console.log(`Password changed for "${existing.username}". Their old logins are now ended.`); }
else { Admin.create(username, hash); console.log(`Admin "${username}" created.`); }
