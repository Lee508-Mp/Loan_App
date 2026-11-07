# Keeping it safe

## Already in the code
- **Passwords** are stored as bcrypt hashes, never as plain text.
- **Login sessions** use a signed token in an `httpOnly`, `SameSite=Strict` cookie (and `Secure` in production). It lasts 2 hours.
- **Admin pages and API** are protected. The dashboard HTML is only sent after the login check.
- **Rate limits:** 10 login attempts and 10 applications per 15 minutes per IP address.
- **Server-side validation** of every field. Interest, total and due date are always calculated on the server.
- **SQL injection:** every query uses parameters. Dashboard text is inserted without HTML, so submitted names cannot run as code.
- **Security headers** (helmet): content-security policy, no sniffing, no framing.
- **Secrets** live in `.env` / Render's environment variables. `.env` and `*.db` are in `.gitignore`.
- **The server refuses to start** with a missing or short `JWT_SECRET`.
- **Errors** are logged on the server. Visitors only see a generic message.
- **Receipts** open with a private link that holds a random 48-character code, so they cannot be guessed. They show the NRC only in part and never the phone number, the email or your private notes. Pressing Undo on the collateral switches a link off.
- **Email** goes only to the company inbox, never to the applicant's address, so the form cannot be used to spam people.

## Honest gaps (decide which matter before going live)
| Gap | Why it matters | Fix |
|---|---|---|
| A receipt link works for anyone who has it and does not expire | If a customer forwards it, others can read that receipt | Undo the collateral record to switch a link off. Add an expiry if you need one |
| One shared admin account, no password-change page | If staff share a login you cannot tell who did what | Add multiple admins and a change-password page |
| No audit log | A company will want to know who edited or deleted a record | Add an `audit_log` table written by `adminController` |
| No 2FA, no account lockout | Rate limiting is per IP only | Add 2FA, or lock an account after repeated failures |
| A login cannot be cancelled early | A stolen session works until it expires (2 hours) | Shorter sessions, or a session table |
| No privacy notice or consent on the form | You collect names and phone numbers | Add a notice and a consent tick box |
| Data not encrypted by the app | Anyone with the database file can read it | Protect the server and backups; consider disk encryption |
| `node:sqlite` is still marked experimental in Node | Its behaviour could change in a future Node version | Pin the Node version; run `npm test` before upgrading |

## Before you publish it for a company
1. **Legal.** You store personal data and the business lends money. Check Zambia's data-protection rules and the licensing rules for lenders with a lawyer. This is not legal advice.
2. **Real numbers.** Replace the placeholder rates in `backend/config/loanRules.js` and test them.
3. **Hosting.** Use a paid Render plan with a persistent disk, and set `DB_PATH=/var/data/loans.db`. The free plan loses data on redeploy. Render serves your site over HTTPS. Also set `NODE_VERSION` to 22 or 24 and check the deploy log shows Node 22.13 or newer.
4. **Secrets.** Generate a new `JWT_SECRET` for production (not your local one) and use a long, unique `ADMIN_PASSWORD`. If either leaks, change it. Never put them in Git or in screenshots.
5. **Backups.** Run `npm run backup` regularly, copy the files somewhere off the server, and practise restoring one. A backup you have never restored is a guess.
6. **Updates.** Run `npm audit` and `npm outdated` monthly. Update, run `npm test`, then deploy.
7. **Admin hygiene.** Share dashboard access with as few people as possible, log out on shared computers, and never leave the dashboard open on a phone you lend out.
8. **Retention.** Decide how long you keep applications and delete old ones (the dashboard has Delete).

## How to develop safely
- `main` is what is live. Do new work on a branch: `git checkout -b feature/short-name`.
- Run `npm test` before committing. Commit small changes with clear messages.
- Push the branch, check it, then merge into `main`. Render redeploys from `main`.
- Check `git status` before every commit: `.env`, `loans.db` and `backups/` must never appear.
- If a secret is ever committed, treat it as leaked: change it, because deleting the commit does not undo that.
