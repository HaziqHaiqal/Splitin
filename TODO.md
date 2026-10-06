# TODO

## Before launch

- [ ] Deploy the app and set the Supabase variables on the host. `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- [ ] Test sharing on real phones (iPhone Safari, Android Chrome): the share menu with the picture attached, and the hand-off to WhatsApp.
- [ ] Check the link preview in WhatsApp using the live address. It cannot be tested on `localhost`.
- [ ] Commit `.env.example`. `.gitignore` has `.env*`, which hides it; add `!.env.example`.
- [ ] Remove the unused packages `sonner` and `nanoid`.
- [ ] Drop the unused `bills.last_activity_at` column and its index `bills_last_activity_at_idx`.
- [ ] Add browser tests (Playwright) to the repository. Today only the money maths and bill logic have tests.
- [ ] Create the `expired_bills` table (id, expired_at; row-level security on, no policies) and make the daily clean-up job record each id it deletes. Until then, a link deleted at 30 days shows "We can't find this receipt" instead of "This receipt has expired". The app already reads the table (`linkExpired` in `src/lib/data/bill.ts`).

## Phase 2

### Activities

A screen where people see their past bill splits and can duplicate one. This replaces the removed "Copy to next month" button.

The list on this device stays free. Keeping history in an account, across phones and computers, is part of the Pro plan (see Subscriptions).

- [ ] List past splits on this device: title, date, total and how many people have paid.
- [ ] Open a past split again from the list.
- [ ] Duplicate a past split into a new one, keeping the people (with bank details) and the bill names and payers.
- [ ] Decide whether a duplicate keeps the amounts. They usually change every month, so blank is the likely default.
- [ ] Store the history. Today the browser keeps one draft (`splitin:draft:v2`) and one owner token per shared bill (`splitin:owner:<id>`), so a history list is new.
- [ ] Decide what the list shows after a shared bill is deleted at 30 days: keep a local copy, or show it as expired.

### AI bill scan

Take a photo or screenshot of a bill and let Claude read it, so nobody types the name and amount by hand.

- [ ] Add "Scan a bill" to the add-bill sheet: camera or photo picker.
- [ ] Read the picture on the server with Claude vision (`@anthropic-ai/sdk`). The key `ANTHROPIC_API_KEY` stays server-only.
- [ ] Start with `claude-haiku-4-5-20251001` because it is cheap and fast. Retry with `claude-sonnet-5-5` when the photo is unclear or the result looks unsure.
- [ ] Ask for a fixed shape and validate it with zod: bill name, amount in sen, and a confidence flag.
- [ ] Always show the result in the add-bill sheet for the person to confirm. Never save a scanned bill automatically.
- [ ] Handle one photo that contains several bills.
- [ ] Shrink the picture in the browser before upload to keep each scan cheap.
- [ ] Limit scans per IP address per day, like the existing limit on new shared bills.
- [ ] Do not keep the photos. If that changes, delete them with the bill at 30 days.
- [ ] Later: restaurant receipts, reading each item so people pick what they had. This needs item-level splitting, which the app does not have.

## Subscriptions

Paid plans for the person who shares. Friends who open a link never pay, sign up or see an upgrade prompt.

### Plans

Prices are starting points to test, not decisions.

|                                       | Free             | Plus                                  | Pro                                   |
| ------------------------------------- | ---------------- | ------------------------------------- | ------------------------------------- |
| Price                                 | RM 0             | about RM 3.90 a month or RM 29 a year | about RM 7.90 a month or RM 59 a year |
| Shared links last                     | 30 days          | 1 year                                | 1 year                                |
| Extend a link that is about to expire | No               | Yes                                   | Yes                                   |
| Past splits                           | This device only | This device only                      | Kept in the account, on every device  |
| Duplicate a past split                | This device only | This device only                      | Yes, from any device                  |
| Monthly repeat (rent, utilities)      | No               | No                                    | Yes                                   |
| AI bill scans                         | A few a month    | A few a month                         | More                                  |
| Export (PDF, CSV)                     | No               | No                                    | Yes                                   |

- [ ] Decide the plans and prices. Check whether people will pay before building payments: for example, a "Keep this link for a year" button that collects interest and an email.
- [ ] Decide whether to also sell a one-off "Keep this link for a year" for about RM 1.90, with no account. It suits people who split once or twice a year, and it fits the no-login idea.

### Accounts

Subscribing needs an account, because the plan has to follow the person to other devices. Everything else stays login-free.

- [ ] Add optional sign-in with Supabase Auth: email link and Google. The only places that ask for it are subscribing and synced history.
- [ ] On sign-in, attach the bills this browser owns (its `splitin:owner:<id>` tokens) to the account.
- [ ] Add `bills.owner_user_id` (empty for bills shared without an account).

### Link expiry

- [ ] Add `bills.expires_at` (creation time + 30 days for free links). The app and the daily clean-up job use it instead of `created_at`, so a paid or extended link can live longer.
- [ ] Owner page: "Expires in 3 days. Keep it longer" when the link is close to its end date.
- [ ] Keep the date a link already got if the plan ends. Cancelling must never make a link disappear early.
- [ ] Change "Links delete themselves after 30 days" to say free links. It appears in the share sheet, the guide (step 5), the expired page, the not-found page and the README.

### History (Pro)

- [ ] Store each Pro user's splits in their account, separate from the shared link. The public link (with names and bank accounts) still expires on its date; only the owner's private copy stays.
- [ ] History list on every device: title, date, total, how many have paid. Open, duplicate, search.
- [ ] Monthly repeat: start this month's split with the same people and bill names, with the amounts left blank.
- [ ] Export a split as PDF or CSV.
- [ ] When Pro ends: history becomes read-only, can still be exported, and is deleted after a notice period.

### Payments

- [ ] Pick a provider. Stripe supports MYR, has hosted checkout and a page where people manage or cancel their plan, and tells the app about changes through webhooks. Its FPX is for one-off payments, so monthly plans need a card. If that hurts sign-ups, sell yearly plans as a one-off FPX payment, or compare local providers with recurring FPX or DuitNow (for example Curlec or Billplz).
- [ ] Add a `subscriptions` table: user, plan, status, paid-until date, provider ids. Only the payment webhook writes to it.
- [ ] Check the plan on the server, in the actions that extend a link or save history. Never trust the browser.
- [ ] A plans page, and the plan and "Manage subscription" in the header menu when signed in.
- [ ] Upgrade prompts only where they help: the share sheet ("Free links last 30 days"), the owner page near the end date, and the settled page ("Save to history").

### Before charging anyone

- [ ] Privacy policy and terms. Paid plans keep names and bank account numbers for longer, so say what is kept, for how long, and how to delete it (Malaysia's PDPA).
- [ ] A way to delete the account and its history.
- [ ] Refund and cancellation rules, and the receipts the provider emails.
- [ ] Check tax registration once revenue grows.

## Ideas, not decided

- Other currencies. The code is RM-only (`currency: "MYR"`).
- A DuitNow QR per person on the pay screen, next to the account number.
- Installable app that works offline.
