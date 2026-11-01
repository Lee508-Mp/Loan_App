# Deploying on Render, and changing things afterwards

## Render form (New > Web Service > your GitHub repo)
| Field | Value |
|---|---|
| Language | Node |
| Branch | main |
| Root Directory | leave blank |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | Free to test. Starter (paid) for real use |
| Disk (paid only) | Add a disk, Mount Path `/var/data` |

## Environment variables (Environment tab)
| Name | Value |
|---|---|
| NODE_ENV | `production` |
| NODE_VERSION | `22` |
| JWT_SECRET | a fresh secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| ADMIN_USERNAME | your first admin's username (3 to 40 letters, numbers, . _ -) |
| ADMIN_PASSWORD | 10 or more characters |
| TIMEZONE | `Africa/Lusaka` (optional, this is the default) |
| DB_PATH | `/var/data/loans.db` (only with a disk) |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO | only if you want email applications |

After the deploy finishes, open `https://YOUR-APP.onrender.com/admin/login`. The deploy log should show Node 22.13 or newer.

## Changing things later
| I want to change | How |
|---|---|
| Interest rates or periods | Edit `TERMS` in `backend/config/loanRules.js` on your laptop, run `npm test`, then `git add .`, `git commit -m "Update rates"`, `git push`. Render redeploys. This is code, not a Render setting. Loans that already exist keep their old rate. If you add or rename a period, also update the period dropdowns in `frontend/views/index.html` and `frontend/views/admin-dashboard.html` |
| Min and max amount, collateral types | Same file, and the matching dropdowns in the two HTML files |
| Terms and Conditions text | `frontend/views/terms.html`, bump `TERMS_VERSION`, push |
| My own admin password | Dashboard > Admins > Change my password |
| Add another admin | Dashboard > Admins > Add an admin. Give them the password in person |
| A colleague forgot their password | Dashboard > Admins > Reset a colleague's password |
| Remove an admin | Dashboard > Admins > Delete next to their name |
| Environment variables (JWT_SECRET, SMTP and so on) | Render > your service > Environment, then Save. Render restarts the service |

Important: editing ADMIN_USERNAME or ADMIN_PASSWORD on Render does NOT change an admin that already exists. They are only used to create the first admin when the database has none.

Changing `JWT_SECRET` signs every admin out. That is expected.

## If every admin is locked out
Keep at least two admins so this never happens. If it does:
- Paid plan with Shell: open Render's Shell for the service and run `npm run admin -- <username> <new-password>`.
- Free plan: a redeploy wipes the database and recreates the admin from your ADMIN_USERNAME and ADMIN_PASSWORD variables, but you lose all applications.

## Moving from Free to paid
Change the instance type in Settings, add the disk at `/var/data`, add `DB_PATH=/var/data/loans.db`, and redeploy. Nothing from the free period carries over.
