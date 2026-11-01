import { liveRights, type BillDoc, type BillRights, type Payment } from "./bill";
import type { BillEvent, EventBody, Who } from "./history";

const SHARE_COLUMNS = "person_id, position, amount_override, browser_hash, joined_at";
const ITEM_COLUMNS = `id, position, name, amount_minor, paid_by, browser_hash, added_at, item_shares(${SHARE_COLUMNS})`;
const PERSON_COLUMNS = "id, position, name, color, bank, account_no, pay_qr, browser_hash, added_at, details_at";
const PAYMENT_COLUMNS = "id, from_person, to_person, amount_minor, by_role, browser_hash, created_at";
const EVENT_COLUMNS = "id, kind, by_role, by_person_id, by_name, data, created_at";

export const BILL_COLUMNS = `id, title, currency, owner_person_id, owner_token_hash, browser_hash, locked, version, started_at, created_at, expires_at, bill_people!bill_people_bill_id_fkey(${PERSON_COLUMNS}), bill_items(${ITEM_COLUMNS}), payments(${PAYMENT_COLUMNS})`;
export const BILL_COLUMNS_WITH_EVENTS = `${BILL_COLUMNS}, bill_events(${EVENT_COLUMNS})`;

export type ShareRow = {
  person_id: string;
  position: number;
  amount_override: number | null;
  browser_hash: string | null;
  joined_at: string | null;
};

export type ItemRow = {
  id: string;
  position: number;
  name: string;
  amount_minor: number;
  paid_by: string;
  browser_hash: string | null;
  added_at: string | null;
  item_shares: ShareRow[];
};

export type PersonRow = {
  id: string;
  position: number;
  name: string;
  color: number;
  bank: string | null;
  account_no: string | null;
  pay_qr: string | null;
  browser_hash: string | null;
  added_at: string | null;
  details_at: string | null;
};

export type PaymentRow = {
  id: string;
  from_person: string;
  to_person: string;
  amount_minor: number;
  by_role: Payment["byRole"];
  browser_hash: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  kind: string;
  by_role: BillEvent["byRole"];
  by_person_id: string | null;
  by_name: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export type BillRow = {
  id: string;
  title: string;
  currency: "MYR";
  owner_person_id: string | null;
  owner_token_hash: string;
  browser_hash: string | null;
  locked: boolean;
  version: number;
  started_at: string;
  created_at: string;
  expires_at: string;
  bill_people: PersonRow[];
  bill_items: ItemRow[];
  payments: PaymentRow[];
  bill_events?: EventRow[];
};

const iso = (at: string) => new Date(at).toISOString();
const isoOrNone = (at: string | null) => (at ? iso(at) : undefined);

export function docFromRow(row: BillRow): BillDoc {
  return {
    title: row.title,
    currency: row.currency,
    createdAt: iso(row.started_at),
    ownerId: row.owner_person_id,
    locked: row.locked ? true : undefined,
    people: row.bill_people.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bank: p.bank ?? undefined,
      accountNo: p.account_no ?? undefined,
      payQr: p.pay_qr ?? undefined,
      addedAt: isoOrNone(p.added_at),
      detailsAt: isoOrNone(p.details_at),
    })),
    items: row.bill_items.map((i) => {
      const joined = i.item_shares.filter((s) => s.joined_at);
      return {
        id: i.id,
        name: i.name,
        amountMinor: Number(i.amount_minor),
        paidBy: i.paid_by,
        participants: i.item_shares.map((s) => s.person_id),
        overrides: Object.fromEntries(
          i.item_shares.filter((s) => s.amount_override !== null).map((s) => [s.person_id, Number(s.amount_override)]),
        ),
        addedAt: isoOrNone(i.added_at),
        joins:
          joined.length > 0
            ? Object.fromEntries(joined.map((s) => [s.person_id, { at: iso(s.joined_at!) }]))
            : undefined,
      };
    }),
  };
}

const hashes = <T extends { browser_hash: string | null }>(rows: T[], key: (row: T) => string) =>
  Object.fromEntries(rows.filter((r) => r.browser_hash).map((r) => [key(r), r.browser_hash!]));

export function rightsFromRow(row: BillRow): BillRights {
  return {
    people: hashes(row.bill_people, (p) => p.id),
    items: hashes(row.bill_items, (i) => i.id),
    joins: Object.fromEntries(
      row.bill_items
        .map((i) => [i.id, hashes(i.item_shares, (s) => s.person_id)] as const)
        .filter(([, joined]) => Object.keys(joined).length > 0),
    ),
    payments: hashes(row.payments, (p) => p.id),
  };
}

export const paymentsFromRow = (row: BillRow): Payment[] =>
  row.payments.map((p) => ({
    id: p.id,
    from: p.from_person,
    to: p.to_person,
    amountMinor: Number(p.amount_minor),
    byRole: p.by_role,
    createdAt: iso(p.created_at),
  }));

export const eventsFromRow = (row: BillRow): BillEvent[] =>
  (row.bill_events ?? []).map(
    (e) =>
      ({
        ...e.data,
        id: e.id,
        kind: e.kind,
        byRole: e.by_role,
        byPersonId: e.by_person_id ?? undefined,
        byName: e.by_name ?? undefined,
        createdAt: iso(e.created_at),
      }) as BillEvent,
  );

export function saveArgs(doc: BillDoc, rights: BillRights) {
  const live = liveRights(doc, rights);
  return {
    p_bill: { title: doc.title, owner_person_id: doc.ownerId ?? null, locked: Boolean(doc.locked) },
    p_people: doc.people.map((p, position) => ({
      id: p.id,
      position,
      name: p.name,
      color: p.color,
      bank: p.bank ?? null,
      account_no: p.accountNo ?? null,
      pay_qr: p.payQr ?? null,
      browser_hash: live.people?.[p.id] ?? null,
      added_at: p.addedAt ?? null,
      details_at: p.detailsAt ?? null,
    })),
    p_items: doc.items.map((i, position) => ({
      id: i.id,
      position,
      name: i.name,
      amount_minor: i.amountMinor,
      paid_by: i.paidBy,
      browser_hash: live.items?.[i.id] ?? null,
      added_at: i.addedAt ?? null,
    })),
    p_shares: doc.items.flatMap((i) =>
      [...new Set(i.participants)].map((person, position) => ({
        item_id: i.id,
        person_id: person,
        position,
        amount_override: i.overrides[person] ?? null,
        browser_hash: live.joins?.[i.id]?.[person] ?? null,
        joined_at: i.joins?.[person]?.at ?? null,
      })),
    ),
  };
}

export const eventRows = (who: Who, events: EventBody[]) =>
  events.map(({ kind, ...data }) => ({
    kind,
    by_role: who.role,
    by_person_id: who.personId ?? null,
    by_name: who.name ?? null,
    data,
  }));
