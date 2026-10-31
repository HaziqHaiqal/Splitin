# Splitin

Split shared bills with friends or family. Name the bill, add the people and who paid what, and Splitin works out who pays who with the fewest payments. Share it as a receipt picture and a link. Nobody signs up or installs anything.

![Splitin on a computer, with the bills on the left and the receipt printing on the right](docs/images/desktop.png)

|                                                Add people and bills                                                 |                                           Friends open the link                                           |                                             Friends join the bills they're in                                             |                                             Everyone sees every change                                             |
| :-----------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------: |
| <img src="docs/images/home.png" alt="Splitin on a phone, with the people on top and the receipt below" width="190"> | <img src="docs/images/link.png" alt="The shared link, showing who pays who and a PAID stamp" width="190"> | <img src="docs/images/join.png" alt="The join form, with bills ticked and the share worked out for each one" width="190"> | <img src="docs/images/history.png" alt="The History list, showing each change with the name and time" width="190"> |

## What it does

- **Several bills, different payers.** For example, Afiq paid the electricity and Haziq paid the water and wifi.
- **Equal split by default.** Change one person's amount and the rest re-splits, or leave someone out of a bill.
- **Share to the group.** Send a receipt picture and a link through WhatsApp or the phone's share menu. Nothing is saved online until you share.
- **Friends use the link.** They pick their name, see who to pay, and tap their payment once they've paid.
- **Friends can add to the bill.** They can add a bill they paid, join the bills they're in, or add their own name if it's missing.
- **The owner stays in control.** The owner can edit any bill, mark any payment, lock the bill, and use a private link to edit from a new phone.
- **History.** Everyone with the link can see every change, with the name and time.
- **Links delete themselves** 30 days after they are created.
- **English and Bahasa Melayu**, light and dark mode, and a built-in guide.

Amounts are in Malaysian Ringgit (RM) only.

## Next MVP

- **Past splits.** See your past splits and duplicate one for next month.
- **Scan a bill.** Take a photo so nobody types the name and amount by hand.
- **Paid plans.** Links that last longer, and past splits on every device. Friends never pay or sign up.

## Tests

- `pnpm test` runs the unit tests.
- `pnpm test:e2e` runs the browser tests against a stand-in database, so it never touches real data.
