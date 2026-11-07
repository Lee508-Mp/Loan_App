# How the site works (architecture)

## The big picture
A visitor's browser asks our Node.js server for a page. The server sends back HTML, CSS and JavaScript. The page's
JavaScript then talks to the server's API (JSON over HTTP). The server checks the data, applies the loan rules,
and saves it in a SQLite database file (`loans.db`). Admins log in to see and manage the saved applications.

```
Browser (HTML + CSS + JS)  <--HTTP/JSON-->  Express server  <-->  SQLite (loans.db)
   frontend/                                     backend/
```

## MVC: where everything lives
| Part | Job | Folder |
|---|---|---|
| **Model** | Talks to the database. All SQL lives here and nowhere else. | `backend/models/` |
| **View** | What the user sees: HTML pages, CSS, browser JavaScript. | `frontend/views/` and `frontend/assets/` |
| **Controller** | Receives a request, calls the right logic, sends the response. Kept thin. | `backend/controllers/` |

Supporting parts:
| Part | Job | Folder |
|---|---|---|
| Routes | Which URL goes to which controller | `backend/routes/` |
| Services | Business logic: loan maths, what happens on approve, login, email | `backend/services/` |
| Validators | Checks incoming data on the server | `backend/validators/` |
| Middleware | Steps every request passes through: login check, rate limits, error handling | `backend/middleware/` |
| Config | Settings (`env.js`) and company rules (`loanRules.js`) | `backend/config/` |

```
loan-app/
  backend/
    server.js                  starts the server
    app.js                     security settings + connects the routes
    config/    env.js, loanRules.js
    routes/    pageRoutes.js, publicApiRoutes.js, adminApiRoutes.js
    controllers/ pageController.js, applicationController.js, adminController.js, authController.js
    services/  applicationService.js, loanCalculator.js, authService.js, mailer.js
    validators/ applicationValidator.js
    models/    database.js, Application.js, Admin.js
    middleware/ requireAdmin.js, rateLimiters.js, errorHandler.js
  frontend/
    views/     index.html, admin-login.html, admin-dashboard.html
    assets/    css/style.css, css/admin.css, js/common.js, js/form.js, js/login.js, js/dashboard.js
  scripts/backup.js            npm run backup
  tests/                       npm test
  docs/                        these notes
```

## The layering rule (this is what keeps it easy to change)
A request flows one way: **route -> controller -> service -> model -> database**.
- SQL only in `models/`.
- Loan rules (rates, limits, collateral types) only in `config/loanRules.js`.
- Controllers never contain business rules. Views never calculate money: the server does, and the page only displays it.

## Two requests, step by step
**An applicant applies (WhatsApp or email)**
1. `form.js` asks `GET /api/loan-terms` as they type, and shows the server's calculation.
2. On send, `POST /api/applications` reaches `applicationController.submit`.
3. `applicationValidator` checks every field again (the browser can be bypassed).
4. `applicationService.submitApplication` works out interest, total and due date, then `Application.create` saves it.
5. Email route: the service emails the company inbox. WhatsApp route: the page opens `wa.me` with the saved details.

**An admin approves a loan**
1. `dashboard.js` sends `PUT /api/admin/applications/:id`.
2. `requireAdminApi` checks the login cookie. No valid login means a 401 error.
3. `adminController.update` validates, then `applicationService.updateApplication` decides the new due date (approval restarts it from today) and `Application.update` saves.
4. `GET /api/admin/alerts` finds approved loans whose due date has passed. The dashboard shows them as overdue and re-checks every minute.

## Where to change things
| I want to... | Change |
|---|---|
| Interest rates, periods, min/max amount, collateral types, statuses | `backend/config/loanRules.js` (then the dropdowns in `frontend/views/*.html`) |
| What counts as overdue, how due dates move | `backend/services/loanCalculator.js`, `applicationService.js` |
| Validation messages and rules | `backend/validators/applicationValidator.js` |
| A new database column | `backend/models/database.js` (`addCol`), then `Application.js` |
| Wording of the approval and receipt messages | `backend/config/messageTemplates.js` |
| Company name and receipt number prefix | `backend/config/loanRules.js` (`COMPANY_NAME`, `RECEIPT_PREFIX`) |
| What the customer sees on the receipt | `backend/services/receiptService.js` (`receiptFor`) and `frontend/views/receipt.html` |
| Collateral received, the repayment clock | `backend/services/receiptService.js` (`markCollateral`), `backend/services/applicationService.js` (`planUpdate`) |
| Colours, fonts, layout | `frontend/assets/css/` |
| Form behaviour | `frontend/assets/js/form.js` |
| Dashboard behaviour | `frontend/assets/js/dashboard.js` |
| WhatsApp number | top of `frontend/assets/js/form.js` |
| Email settings | `.env` |

### Checklist: adding a new field to the form (for example "National ID")
1. `models/database.js`: `addCol("national_id", "TEXT NOT NULL DEFAULT ''")`
2. `validators/applicationValidator.js`: validate it and add it to `value`
3. `models/Application.js`: add it to `create` and `update`
4. `services/applicationService.js`: add it to `editDefaults`
5. `views/index.html` and `assets/js/form.js`: add the input, validation, review row
6. `views/admin-dashboard.html` and `assets/js/dashboard.js`: show and edit it
7. `tests/`: add a test, then run `npm test`

## Tests and scripts
- `npm test` runs 26 automated checks (loan maths, validation, and the whole API against a throwaway database).
  Run it before every push.
- `npm run backup` saves a copy of the database into `backups/`.
- `npm run dev` runs the server and restarts it when you save backend files.
