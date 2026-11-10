# KANDOZ INVESTMENTS LIMITED Loans: loan application site with admin dashboard

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
| POST | /api/admin/applications/:id/collateral-received | yes | received (true or false), notes (optional) |
| POST | /api/admin/applications/:id/money-given | yes | given (true or false), date (optional, YYYY-MM-DD, default today) |
| POST | /api/admin/applications/:id/repayment | yes | paidOn (optional), amountPaid (optional), moneyGivenOn (only for older loans with no date) |
| POST | /api/admin/applications/:id/cancel | yes | reason (at least 3 characters) |
| GET | /api/admin/reports/profit?from=2026-03-01&to=2026-03-31 | yes | The profit report as JSON. No dates means this month so far |
| GET | /api/admin/reports/profit.csv?from=...&to=... | yes | The same report as a CSV file |
| GET | /api/admin/expenses?from=...&to=... | yes | Expenses and losses in those dates |
| POST | /api/admin/expenses | yes | spentOn (optional, default today), kind (expense or loss), description, amount, loanId (optional) |
| DELETE | /api/admin/expenses/:id | yes | |
| GET | /api/admin/applications/:id/message?kind=approval | yes | kind is approval or receipt. Returns the filled-in message |
| POST | /api/admin/applications/:id/messages | yes | kind, text. Logs the message and returns the WhatsApp link |
| GET | /api/receipts/:token | none | The customer's receipt. Needs the secret link |
| GET | /api/admin/alerts | yes | |
| GET | /api/admin/applications?search=&status= | yes | status: new, contacted, approved, rejected, repaid, cancelled or overdue |
| GET | /api/admin/applications/:id | yes | |
| PUT | /api/admin/applications/:id | yes | name, phone, amount, period, collateralType, collateralDetails, contactMethod, email, status, notes, dueDate (optional, YYYY-MM-DD) |
| DELETE | /api/admin/applications/:id | yes | Refused (409) if money was given or the loan is repaid. Use cancel instead |

period: "1 week", "2 weeks", "3 weeks" or "1 month". contactMethod: "whatsapp" or "email".
collateralType: Vehicle, Land or property, Electronics, Household items, Livestock, Business stock or equipment, Other.
Postman keeps the login cookie. Or copy `token` from the login response into Authorization > Bearer Token.

## Admin accounts
The first admin is created from ADMIN_USERNAME and ADMIN_PASSWORD. After that, use the **Admins** button on the dashboard to add colleagues, reset a colleague's password, delete an admin, or change your own password. Changing `ADMIN_PASSWORD` later does NOT change an existing account. All admins see the same applications. See `docs/DEPLOY.md`.

## Collateral, messages and receipts
From approval to receipt, an admin does four things. They all happen in the dashboard, behind the **Messages** button, which shows on approved loans.

1. **Approve the loan.** Press **Edit**, set **Status** to `approved`, press **Save changes**. If you agreed a lower rate with the customer, type it in **Negotiated rate %** first. The loan now shows **Awaiting collateral** in the Due date column, and the banner at the top lists it as "Approved, waiting for collateral". The repayment clock has not started, so it cannot become overdue yet.
2. **Send the approval message.** Press **Messages**, then **Write the approval message**. The text is filled in for you: the customer's name, the amount, the interest rate (marked when it was negotiated), the total to repay, the collateral accepted, and the line "The money will be given to you once you deliver the collateral to us". Change anything in the box, press **Open WhatsApp**, then press **Send** inside WhatsApp. The message is logged under **Messages sent**, with who sent it and when.
3. **Record the collateral.** When the customer delivers it, press **Messages**, type notes (plate or serial number, condition), and press **Collateral received**. Today becomes the start date. The repayment date is today plus the loan period, overdue alerts count from it, and the receipt is created. Pressed by mistake? Press **Undo**. Pressing it twice never moves the date.
4. **Send the receipt.** Press **Write the receipt message**. It contains a private link to the customer's receipt. Edit it if you like, press **Open WhatsApp**, then **Send**.

**The customer's receipt** opens from the link on any phone, with no login. It shows the receipt number (like KIL-2026-0007), the date the collateral was received, the customer's name, location and NRC with only the last digits showing (`******/78/1`), the amount borrowed, the interest rate, the interest, the total to repay, the repay-by date, and the collateral. It never shows the phone number, the email address or your private notes. The customer can press **Print or save as PDF**.

**Good to know**
- WhatsApp links can only carry text, not files. That is why the receipt is sent as a link, and you press Send yourself.
- Anyone who has the receipt link can read the receipt. The link has a random 48-character code that cannot be guessed. To switch a link off, press **Undo** on the collateral. It works again when you record the collateral again.
- On the free Render plan the database can be wiped when the service restarts or redeploys, and then the receipt links stop working. Use a paid plan with a disk before real customers get receipts.
- Receipt numbers are built from the year and the loan's reference number, so they are unique but can skip numbers if you delete loans.

**Changing the wording and settings**
- Message wording: `backend/config/messageTemplates.js`. Restart the server after editing it.
- Company name and the receipt number prefix: `COMPANY_NAME` and `RECEIPT_PREFIX` in `backend/config/loanRules.js`.
- Receipt links use the web address the admin is on. If you move to your own domain, you can set `PUBLIC_URL` (for example `https://loans.mycompany.com`) in the environment variables.
- What the customer sees on the receipt: `backend/services/receiptService.js` and `frontend/views/receipt.html`.

**Try it in Postman** (log in first, then use the loan's ID)
1. `PUT /api/admin/applications/1` with `"status": "approved"` and the loan's other fields.
2. `GET /api/admin/applications/1/message?kind=approval` shows the message text.
3. `POST /api/admin/applications/1/messages` with `{"kind": "approval", "text": "your edited text"}` returns the WhatsApp link.
4. `POST /api/admin/applications/1/collateral-received` with `{"received": true, "notes": "Plate ABC 1234"}` returns the loan, including `receipt_token`.
5. Open `/receipt/<receipt_token>` in a browser, or call `GET /api/receipts/<receipt_token>` with no login.

## Money given, repayments and cancelled loans
These records are the base for the profit report. Every loan now keeps three dates: when the money was given, when it was repaid, and the amount paid. Fill them in as things happen, and the report will be right.

**1. Money given.** After the collateral is received, press **Messages** on the loan. Step 3, **Money given**, has a date box (leave it empty for today). Press **Money given**. The loan's **Money given** column shows the date. Pressed by mistake? Press **Undo** (not possible once the loan is repaid). Until you do this, the banner lists the loan under "Collateral received, money not given yet", so nobody is forgotten.

**2. Mark repaid.** When the customer pays back, press **Mark repaid** on the row. A small window asks for the repaid date (empty means today) and the amount paid. The total to repay is filled in for you. Change it if the customer paid a different amount. Press **Save repayment**. The loan becomes `repaid`, and the overdue alert goes away. The repaid date cannot be in the future, or before the money was given.

**3. Cancel a loan.** If a loan will not go ahead after money was given, press **Cancel loan** on the row and give a reason. The loan stays on record, marked `cancelled`, and the money it received still counts as money given out. A cancelled loan keeps its reason and date.

**Delete is limited.** The **Delete** button only appears for loans where no money was given. After that, the button becomes **Cancel loan**, and repaid loans can only be viewed or edited. This stops past reports from changing.

**Older loans.** Loans you repaid before this update have no dates. The banner lists them: "Repaid loans missing dates". Press **Edit** on each, fill in **Money given on**, **Repaid on** and **Amount paid**, and save. The banner clears when every repaid loan has its dates. For an older approved loan, **Mark repaid** also asks for the money given date.

**The Edit window** also has these fields, for corrections: Money given on, Repaid on, Amount paid and Cancel reason. Saving checks that the dates make sense (for example, a loan cannot be repaid before the money was given). If you set a repaid loan back to `approved`, its repaid date and amount are cleared, so you can fix a mistake.

## Reports: profit, expenses and losses
Press **Reports** at the top of the dashboard. It adds up the dates and amounts recorded on your loans, and the expenses and losses you enter, for any dates you choose.

**How to use it**
1. **Pick the dates.** Use **From** and **To**, or the quick buttons: This week, This month, Last month, This year. Press **Show report**. When you open it, it shows this month so far.
2. **Read the cards.**
   - **Money given out:** loans whose Money given date is in those dates.
   - **Collected from customers:** what customers paid on loans repaid in those dates.
   - **Interest collected:** what was collected, minus the money you originally gave on those same loans. "Agreed" shows what the interest was supposed to be, so you can see short payments.
   - **Expenses** and **Losses:** the entries you recorded (see below).
   - **PROFIT:** interest collected, minus expenses, minus losses. A negative profit shows in red.
   - **Interest expected:** the interest on loans still out on the last day. It is not profit until it is paid.
   - **Overdue right now:** the total to repay on loans that are overdue today.
   - **Net cash:** collected, minus money given out, minus expenses.
3. **Look at the tables.** **Month by month** shows each month in the range. **By repayment period** shows which periods (1 week, 2 weeks and so on) earned the most.
4. **Download the CSV.** Press **Download CSV for your accountant**. The file has the totals, the month-by-month table, and the lists of loans repaid, money given, and expenses.

**Recording expenses and losses.** Use the form in the Reports window: date (empty means today), type, a short description, the amount, and optionally a loan number.
- An **expense** is a running cost, such as transport, airtime or rent.
- A **loss** is loan money that will not come back. Use it when you cancel a loan after giving the money, and enter that loan's number. The report warns you about cancelled loans that had money given.
- A wrong entry can be deleted from the list under the form.

**A worked example.** In March you gave out K2,500 across 3 loans. One loan was repaid in March: K1,100 paid on K1,000 given, so interest collected is K100. You spent K200 on transport. **Profit = K100 - K200 = -K100.** Interest on loans still out is shown under "Interest expected", not in profit.

**Good to know**
- Interest is counted when it is **paid**, on the day the loan is marked repaid. A loan given in March and repaid in April counts as April's interest.
- A loan that was never given a Money given date, or a repaid loan with no dates, cannot be counted. The report warns you. Press **Edit** on those loans and add the dates.
- Deleted loans disappear from the report, which is why loans with money given can no longer be deleted.
- Every admin can see the reports and the expenses. There are no separate roles yet.
- On the free Render plan the database can be wiped, which erases your history. Download the CSV often, and use a paid plan with a disk before you rely on the reports.

## Terms and Conditions
Visitors must accept `/terms` before they can see the form. The server also requires `acceptedTerms: true` and saves the time and version of acceptance with each application. Edit the text in `frontend/views/terms.html` (placeholder text: have a lawyer review it) and bump `TERMS_VERSION` in `backend/config/loanRules.js`.

## Rules
- The server calculates interest, total and due date. The browser only displays them.
- Interest is flat, charged once. The estimated due date counts from the application day and restarts when a loan is set to `approved`. The repayment clock really starts when the collateral is received, and the due date is set again then.
- Overdue = status `approved`, collateral received, and due date before today (Zambia time). An approved loan still waiting for its collateral is never overdue. `repaid` clears it.
- A loan with money given, or a repaid loan, can never be deleted. It is kept on record. A loan that will not go ahead is cancelled, with a reason.
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
