# Splitin

Splits shared bills for people in Malaysia (RM only, English and Bahasa Melayu). Next.js 16 and React 19 on Vercel, Supabase Postgres for shared bills. No login: rights come from an httpOnly cookie and owner links. Live at https://www.splitin.me.

## Commands

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (unit), `pnpm build`
- In a fresh copy, run `pnpm exec next typegen` before `pnpm typecheck`, or Next's `PageProps` types are missing.
- `pnpm test:e2e` runs the browser tests against a local database. Run `supabase start` first (needs Docker).

## Rules for every change

- Keep it simple: few screens, calm look. No login, landing page, groups or tabs.
- Say "people" or "anyone", not "friend", in text, code and database names.
- Every piece of text people see goes in both `src/i18n/en.ts` and `src/i18n/ms.ts`.
- When a change alters what people see or do, update in the same change: `help.steps` in both language files, the demo in `src/components/help/how-to.tsx`, `tests/guide.test.ts`, and the README if a line becomes wrong.
- Write almost no code comments. Only tool directives or security warnings.
- Bump `version` in `package.json` when app code changes: patch for fixes and small look or wording changes, minor for a new feature, major only when existing links or habits break. One bump per PR. No bump for README, test or CI-only changes.
- Stay on ESLint 9 and TypeScript 5.x (newer majors break lint). `@types/node` follows Node 24.
- Phones come first. Inputs in bottom panels stay at least 16px, or iOS zooms. Canvas or Safari-specific work must also be checked in WebKit, because people pay from iPhones.

## Data and privacy

- Bills hold names and bank account numbers, and a bill code opens a bill. Never log them or put them in issues, PRs, commits or test snapshots. This repo is public.
- `src/instrumentation.ts` reports server errors to Orbis (`.github/workflows/orbis.yml`), where they are public. Everything it sends goes through `scrub` in `src/lib/alarm.ts`.
- Never write to the production database. Schema changes go into `supabase/migrations/20261101000000_init.sql` (the local test database is built from it; don't add new migration files). The PR says what has to run on production, and the owner applies it.
- The service-role client in `src/lib/supabase/server.ts` must never reach client code.
- Links expire a fixed 30 days after they are created. Never describe expiry as idle time or "no activity".

## Checks before a PR

Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` and `pnpm build`. CI also runs the browser tests. In a PR, say how to check the change on the Vercel preview link.
