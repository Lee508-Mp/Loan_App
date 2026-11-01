# Copperline Loans: loan application site with admin dashboard

Applicants fill in a form (amount, period, collateral) and send it by WhatsApp or email. The server calculates
interest and due dates. Admins log in to manage applications and see overdue loans.

Read `docs/ARCHITECTURE.md` (how it works and where to change things) and `docs/SECURITY.md` (keeping it safe).

## Folders (MVC)
```
backend/   Node.js + SQLite
  models/ (database)   controllers/ (requests)   routes/   services/ (business logic)
  validators/   middleware/   config/ (env.js, loanRules.js)   server.js   app.js
frontend/  views/ (HTML pages)   assets/ (css and browser js)
scripts/   backup.js         tests/   automated tests         docs/   notes
```

## Run it (Windows 11, PowerShell in VS Code, inside the loan-app folder)
1. Install Node.js LTS (22.13 or newer) from nodejs.org. Check: `node -v`
2. `npm install` (from the folder that contains package.json; nothing needs compiling)
3. `Copy-Item .env.example .env`
4. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`, paste the result into `.env` as JWT_SECRET
5. In `.env`, set ADMIN_USERNAME and ADMIN_PASSWORD (10+ characters)
6. Set WHATSAPP_NUMBER at the top of `frontend/assets/js/form.js`
7. `npm run dev`, then open http://localhost:3000 (not Live Server: the form needs the backend)
   Admin login: http://localhost:3000/admin/login

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Start, restarting when backend files change |
| `npm start` | Start (what Render runs) |
| `npm test` | Run the automated tests (always before pushing) |
| `npm run backup` | Copy the database into `backups/` |
| `npm run admin -- <username> <password>` | Emergency: create an admin or set a new password |

## API (Postman, base URL http://localhost:3000)
| Method | URL | Auth | Body |
|---|---|---|---|
| POST | /api/applications | none | acceptedTerms (must be true), name, phone, amount, period, collateralType, collateralDetails (optional), contactMethod, email (if email) |
| GET | /api/loan-terms?amount=5000&period=2 weeks | none | |
| POST | /api/admin/login | none | username, password |
| POST | /api/admin/logout | cookie | |
| GET | /api/admin/me | yes | |
| POST | /api/admin/change-password | yes | currentPassword, newPassword |
| GET | /api/admin/admins | yes | |
| POST | /api/admin/admins | yes | username, password (10 to 72 characters) |
| PUT | /api/admin/admins/:id/password | yes | newPassword (for a colleague) |
| DELETE | /api/admin/admins/:id | yes | |
| GET | /api/admin/alerts | yes | |
| GET | /api/admin/applications?search=&status= | yes | status: new, contacted, approved, rejected, repaid or overdue |
| GET | /api/admin/applications/:id | yes | |
| PUT | /api/admin/applications/:id | yes | name, phone, amount, period, collateralType, collateralDetails, contactMethod, email, status, notes, dueDate (optional, YYYY-MM-DD) |
| DELETE | /api/admin/applications/:id | yes | |

period: "1 week", "2 weeks", "3 weeks" or "1 month". contactMethod: "whatsapp" or "email".
collateralType: Vehicle, Land or property, Electronics, Household items, Livestock, Business stock or equipment, Other.
Postman keeps the login cookie. Or copy `token` from the login response into Authorization > Bearer Token.

## Admin accounts
The first admin is created from ADMIN_USERNAME and ADMIN_PASSWORD. After that, use the **Admins** button on the dashboard to add colleagues, reset a colleague's password, delete an admin, or change your own password. Changing `ADMIN_PASSWORD` later does NOT change an existing account. All admins see the same applications. See `docs/DEPLOY.md`.

## Terms and Conditions
Visitors must accept `/terms` before they can see the form. The server also requires `acceptedTerms: true` and saves the time and version of acceptance with each application. Edit the text in `frontend/views/terms.html` (placeholder text: have a lawyer review it) and bump `TERMS_VERSION` in `backend/config/loanRules.js`.

## Rules
- The server calculates interest, total and due date. The browser only displays them.
- Interest is flat, charged once. The estimated due date counts from the application day and restarts when a loan is set to `approved`.
- Overdue = status `approved` and due date before today (Zambia time). `repaid` clears it.
- Interest and total only change if a loan's amount or period changes, so editing rates later never alters existing loans.
- The rates in `backend/config/loanRules.js` are placeholders. Set your real ones before going live.

## Email (optional)
Fill SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and MAIL_TO in `.env` (Gmail: smtp.gmail.com, 587, a Google App Password).
Without it, email applications are still saved and appear in the dashboard.

## Deploy (Render Web Service)
Build command `npm install`, start command `npm start`, no root directory. Environment variables: JWT_SECRET, ADMIN_USERNAME,
ADMIN_PASSWORD, NODE_ENV=production, NODE_VERSION=22. For real data use a paid plan with a persistent disk and set DB_PATH=/var/data/loans.db.

## Troubleshooting
- "ExperimentalWarning: SQLite" is harmless.
- `npm install` fails with EPERM: close other terminals, delete `node_modules`, retry. Keep the project out of OneDrive-synced folders.
- "Set JWT_SECRET": `.env` is missing or JWT_SECRET is empty.
