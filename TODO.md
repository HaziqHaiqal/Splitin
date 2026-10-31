# TODO

## Before launch

- [ ] Test on a real iPhone: the keyboard with the forms, the "Who are you?" popup, adding a name, joining bills and the owner link.
- [ ] Test sharing on real phones (iPhone and Android): the picture in the share menu and the hand-off to WhatsApp.
- [ ] Check the link preview in WhatsApp.
- [ ] After a link is deleted at 30 days, show "This receipt has expired" instead of "We can't find this receipt".

## Next

### Past splits

See past splits and duplicate one. This replaces the removed "Copy to next month" button.

- [ ] List past splits on this device, and open one again.
- [ ] Duplicate a split, keeping the people and bill names. Amounts usually change every month, so they probably start blank.
- [ ] Decide what the list shows after a link is deleted at 30 days.

### Scan a bill

Take a photo of a bill so nobody types the name and amount by hand.

- [ ] Add "Scan a bill" to the add bill form, and always let the person confirm before saving.
- [ ] Handle one photo with several bills.
- [ ] Limit scans per day, and don't keep the photos.
- [ ] Later: restaurant receipts, where each person picks what they had.

## Subscriptions

Paid plans for the person who shares. Friends who open a link never pay, sign up or see an upgrade prompt. Prices are starting points to test, not decisions.

|                                  | Free             | Plus                                  | Pro                                   |
| -------------------------------- | ---------------- | ------------------------------------- | ------------------------------------- |
| Price                            | RM 0             | about RM 3.90 a month or RM 29 a year | about RM 7.90 a month or RM 59 a year |
| Shared links last                | 30 days          | 1 year                                | 1 year                                |
| Past splits                      | This device only | This device only                      | On every device                       |
| Monthly repeat (rent, utilities) | No               | No                                    | Yes                                   |
| Bill scans                       | A few a month    | A few a month                         | More                                  |
| Export (PDF, CSV)                | No               | No                                    | Yes                                   |

- [ ] Decide the plans and prices. Check people will pay before building payments, for example with a "Keep this link for a year" button that collects interest and an email.
- [ ] Decide whether to also sell a one-off "Keep this link for a year" for about RM 1.90, with no account.
- [ ] Add optional sign-in, asked for only when subscribing or syncing past splits.
- [ ] Let paid links last longer. Cancelling must never make a link disappear early.
- [ ] Pick a payment provider that works well in Malaysia (FPX, DuitNow).
- [ ] Before charging anyone: privacy policy and terms, a way to delete an account, and refund rules.

## Ideas, not decided

- Other currencies.
- A DuitNow QR per person, next to the account number.
- An installable app that works offline.
