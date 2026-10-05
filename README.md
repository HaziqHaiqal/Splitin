# Splitin

Split shared bills with friends or family. Add the people, add the bills and who paid each one, and Splitin works out who owes whom with the fewest payments. Share the result as a receipt picture and a link. Nobody signs up or installs anything.

Planned work is in [TODO.md](TODO.md).

## What it does

- **Opens straight into the tool.** No landing page and no login.
- **Several bills, different payers.** For example, Afiq paid the electricity and Haziq paid the water and wifi.
- **Equal split by default.** You can type a different amount for one person and the rest re-splits, or leave someone out of a bill.
- **Receipt-style summary.** Each person's share, who owes and who collects, and the smallest set of payments that settles everything.
- **Share to the group.** A picture of the receipt plus a link, sent through WhatsApp or the phone's share menu.
- **Friends use the link.** They pick their name, copy the bank account number and tap "I've paid". The person who shared sees a PAID stamp and can send reminders.
- **Links delete themselves** 30 days after they are created.
- **English and Bahasa Melayu**, dark and light mode. New visitors get English and dark mode.
- **Phone and desktop layouts**, plus a built-in "How to use Splitin" guide with small try-it demos.

Amounts are in Malaysian Ringgit (RM) only.

## How it works

**Drafts stay on the device.** While you add people and bills, everything is saved in the browser's `localStorage` (`splitin:draft:v2`). Nothing reaches the server until you tap "Share receipt".

**Sharing creates a link.** "Share receipt" saves the bill to the `bills` table and returns a random id, so the link is `/bill/<id>`. The browser that shared it also gets a secret owner token (`splitin:owner:<id>`); only its hash is stored in the database. Whoever holds the token can edit the bill. Anyone with the link can mark a payment as paid or undo it.

**Money is whole sen.** All amounts are integers, so nothing is lost to decimals. When an amount does not divide evenly, the leftover sen go to the first people in the list: RM 240.90 between four people is 60.23, 60.23, 60.22 and 60.22. The maths is in [src/lib/money](src/lib/money) and [src/lib/bill.ts](src/lib/bill.ts).

**Live updates.** After a change, the server sends a small "changed" signal on the Supabase Realtime channel `bill:<id>`. It carries no data. Open pages hear it and reload their data from the server.

**Automatic deletion.** A shared bill stops loading 30 days after it was created, and a daily database job deletes it, together with its payments.

**Access control.** Row-level security is on for both tables with no policies, so the public key cannot read or write anything. Only server code, using the service-role key, touches the tables. Sharing is limited to 30 new bills per hour per IP address.

**Receipt picture.** The receipt is drawn in the page and captured as a PNG in the browser. On phones it goes to the system share menu with the message. On computers it is copied to the clipboard and WhatsApp opens with the message and link.
