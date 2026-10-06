# TODO

## Before launch

- [ ] Deploy the app and set the Supabase variables on the host. `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- [ ] Test sharing on real phones (iPhone Safari, Android Chrome): the share menu with the picture attached, and the hand-off to WhatsApp.
- [ ] Check the link preview in WhatsApp using the live address. It cannot be tested on `localhost`.
- [ ] Commit `.env.example`. `.gitignore` has `.env*`, which hides it; add `!.env.example`.
- [ ] Remove the unused packages `sonner` and `nanoid`.
- [ ] Drop the unused `bills.last_activity_at` column and its index `bills_last_activity_at_idx`.
- [ ] Add browser tests (Playwright) to the repository. Today only the money maths and bill logic have tests.
- [ ] Make the phone address-bar colour follow the theme. It is always dark now, even in light mode.

## Phase 2

### Activities

A screen where people see their past bill splits and can duplicate one. This replaces the removed "Copy to next month" button.

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

## Ideas, not decided

- Other currencies. The code is RM-only (`currency: "MYR"`).
- A DuitNow QR per person on the pay screen, next to the account number.
- Installable app that works offline.
