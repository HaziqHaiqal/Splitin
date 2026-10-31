# Splitin

Split shared bills with friends or family. Add the people, add the bills and who paid each one, and Splitin works out who owes whom with the fewest payments. Share the result as a receipt picture and a link. Nobody signs up or installs anything.

![Splitin on a computer, with the bills on the left and the receipt printing on the right](docs/images/desktop.png)

|                                                Add people and bills                                                 |                                           Friends open the link                                           |                                             Friends join the bills they're in                                             |                                             Everyone sees every change                                             |
| :-----------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------: |
| <img src="docs/images/home.png" alt="Splitin on a phone, with the people on top and the receipt below" width="190"> | <img src="docs/images/link.png" alt="The shared link, showing who pays who and a PAID stamp" width="190"> | <img src="docs/images/join.png" alt="The join form, with bills ticked and the share worked out for each one" width="190"> | <img src="docs/images/history.png" alt="The History list, showing each change with the name and time" width="190"> |

Planned work is in [TODO.md](TODO.md).

## What it does

- **Opens straight into the tool.** No landing page and no login.
- **Several bills, different payers.** For example, Afiq paid the electricity and Haziq paid the water and wifi.
- **Equal split by default.** You can type a different amount for one person and the rest re-splits, or leave someone out of a bill.
- **Receipt-style summary.** Each person's share, who owes and who collects, and the smallest set of payments that settles everything.
- **Share to the group.** A picture of the receipt plus a link, sent through WhatsApp or the phone's share menu.
- **Friends use the link.** It opens on the receipt: who pays who, the bank account numbers, and PAID stamps as payments come in. Someone who has paid taps their payment on the receipt and confirms, one payment at a time. The person who shared sees who marked what and can mark any payment unpaid again. The person who shared can also mark payments and send reminders.
- **Friends say who they are.** The first time they open the link, "Who are you?" lists the names, "Not on the list" and "Just looking". After that the page says "Hi Imanul!", with "Not Imanul?" beside it to switch or clear the name. Only their own payments can be tapped. "Just looking" can't mark anything until they choose a name, and adding or joining a bill asks for it first.
- **Friends can add what they paid.** They add a bill from the link, and can delete only what they added, on the same phone.
- **Friends can add their own name.** Someone missing taps "Not on the list" and types their name. Nobody's amount changes until they join a bill. Whoever adds a bill sees all the names and can add a new one with "+ Add".
- **Friends can join the bills they're in.** They tick some bills, or "Join all". Their share is worked out for them, or they can write their own amount. Anyone who already paid more than their new share gets a line on the receipt paying them back.
- **Different amounts.** If someone sent more or less than the receipt says, they tap that payment and record the real amount. The two names can't be changed, and the receipt works out the rest. The owner can record a payment between any two people.
- **The owner stays in control.** The owner can edit any bill, lock the bill so friends can only mark payments, and use a private owner link to edit from a new phone. A person with a payment marked can't be removed until it's marked unpaid.
- **History.** Everyone with the link can see every change, with the name and time: bills added, changed or deleted, people and bank details updated, payments marked or undone. Names are not verified, because there is no login.
- **Links delete themselves** 30 days after they are created.
- **English and Bahasa Melayu**, dark and light mode. New visitors get English and light mode.
- **Phone and desktop layouts**, plus a built-in "How to use Splitin" guide with small try-it demos.

Amounts are in Malaysian Ringgit (RM) only.

## How it works

**Drafts stay on the device.** While you add people and bills, everything is saved in the browser's `localStorage` (`splitin:draft:v2`). Nothing reaches the server until you tap "Share receipt".

**Sharing creates a link.** "Share receipt" saves the bill to the `bills` table and returns a random id, so the link is `/bill/<id>`. The browser that shared it also gets a secret owner token (`splitin:owner:<id>`); only its hash is stored in the database. Whoever holds the token can edit the bill and mark or undo any payment. Anyone else can only mark a payment that is still open, for its exact amount, and undo a mark made from the link within 15 minutes.

**Friends' bills.** A friend's bill is saved in the same `doc`. The server gives the friend's browser a secret key (`splitin:mine:<id>`) and stores only its hash on the item, and that key is the only way for a friend to delete it. If the owner edits the item, the key stops working.

**Friends' names and joins.** These are saved in the same `doc`. A new name gets a secret key (`splitin:names:<id>`) and joining a bill gets one too (`splitin:joins:<id>`); the database stores only their hashes. The key is what lets that phone change the amount, leave the bill, or add bank details for that name. Friends can only leave bills they joined themselves. The server refuses a duplicate name, an amount above what's left on a bill, more than 50 people, and any friend change on a locked bill.

**Saving never overwrites friends.** The owner's phone can hold an old copy of the bill, so each save is merged with what's on the server (`mergeFriendChanges`). Whatever friends did since the owner last looked is kept, and it isn't logged in History as the owner's change. If the owner removes something they have already seen, it stays removed.

**The owner's name and link.** On the first share, the owner picks which name is theirs, or says they are not on the list (`doc.ownerId`). Bills shared before this was added treat the first name as the owner. The owner link is `/bill/<id>#owner=<token>`. The token is in the `#` part so it never reaches the server logs, and the page removes it from the address bar after using it.

**Who's opening the link.** The name is saved per bill on that phone (`splitin:me:<id>`), and `splitin:asked:<id>` stops the question coming back, however it was answered. The owner's phone never gets the question.

**History.** Each change adds a row to the `bill_events` table. A friend's name comes from the person they picked (`splitin:me:<id>`), which the server looks up on the bill, so it can't be made-up text. For a payment, it's the person paying. Bank account numbers are never recorded. If history can't be read or written, the bill keeps working.

**Money is whole sen.** All amounts are integers, so nothing is lost to decimals. When an amount does not divide evenly, the leftover sen go to the first people in the list: RM 240.90 between four people is 60.23, 60.23, 60.22 and 60.22. The maths is in [src/lib/money](src/lib/money) and [src/lib/bill.ts](src/lib/bill.ts).

**Live updates.** After a change, the server sends a small "changed" signal on the Supabase Realtime channel `bill:<id>`. It carries no data. Open pages hear it and reload their data from the server.

**Automatic deletion.** A shared bill stops loading 30 days after it was created, and a daily database job deletes it, together with its payments and history.

**Access control.** Row-level security is on for every table with no policies, so the public key cannot read or write anything. Only server code, using the service-role key, touches the tables. Sharing is limited to 30 new bills per hour per IP address, and friends' changes to 100 per hour per bill. A friend can undo only their own payment, for 15 minutes, using a key the server signs (the owner can always undo).

**Receipt picture.** The receipt is drawn in the page and captured as a PNG in the browser. On phones it goes to the system share menu with the message. On computers it is copied to the clipboard and WhatsApp opens with the message and link.

## Tests

- `pnpm test` runs the unit tests for the money maths and bill logic.
- `pnpm test:e2e` runs the browser tests with Playwright, using the Chrome installed on your computer. It starts the app on port 3457 against a small stand-in for the database ([e2e/stub.mjs](e2e/stub.mjs)), so it never touches real data.
