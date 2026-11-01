create extension if not exists pg_cron;

create table public.bills (
  id text primary key check (id ~ '^[A-Za-z0-9]{8,16}$'),
  title text not null check (char_length(title) between 1 and 60),
  currency text not null default 'MYR' check (currency = 'MYR'),
  owner_person_id text,
  owner_token_hash text not null,
  browser_hash text,
  ip_hash text,
  locked boolean not null default false,
  version integer not null default 0,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index bills_ip_hash_created_at on public.bills (ip_hash, created_at);
create index bills_expires_at on public.bills (expires_at);

create table public.bill_people (
  bill_id text not null references public.bills on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  position integer not null,
  name text not null check (char_length(name) between 1 and 30),
  name_key text generated always as (lower(name)) stored,
  color integer not null check (color between 0 and 99),
  bank text check (char_length(bank) <= 40),
  account_no text check (char_length(account_no) <= 40),
  browser_hash text,
  added_at timestamptz,
  details_at timestamptz,
  primary key (bill_id, id),
  constraint one_name_per_bill unique (bill_id, name_key) deferrable initially deferred
);

alter table public.bills
  add constraint bills_owner_fkey foreign key (id, owner_person_id)
  references public.bill_people (bill_id, id) deferrable initially deferred;

create table public.bill_items (
  bill_id text not null references public.bills on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  position integer not null,
  name text not null check (char_length(name) between 1 and 60),
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  paid_by text not null,
  browser_hash text,
  added_at timestamptz,
  primary key (bill_id, id),
  foreign key (bill_id, paid_by) references public.bill_people (bill_id, id) deferrable initially deferred
);

create table public.item_shares (
  bill_id text not null,
  item_id text not null,
  person_id text not null,
  position integer not null,
  amount_override bigint check (amount_override between 0 and 10000000000),
  browser_hash text,
  joined_at timestamptz,
  primary key (bill_id, item_id, person_id),
  foreign key (bill_id, item_id) references public.bill_items (bill_id, id) on delete cascade,
  foreign key (bill_id, person_id) references public.bill_people (bill_id, id) deferrable initially deferred
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id text not null references public.bills on delete cascade,
  from_person text not null,
  to_person text not null,
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  by_role text not null check (by_role in ('owner', 'member')),
  browser_hash text,
  created_at timestamptz not null default now(),
  check (from_person <> to_person),
  foreign key (bill_id, from_person) references public.bill_people (bill_id, id),
  foreign key (bill_id, to_person) references public.bill_people (bill_id, id)
);

create index payments_bill_id_created_at on public.payments (bill_id, created_at);

create table public.bill_events (
  id uuid primary key default gen_random_uuid(),
  bill_id text not null references public.bills on delete cascade,
  kind text not null,
  by_role text not null check (by_role in ('owner', 'member')),
  by_person_id text,
  by_name text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (bill_id, by_person_id) references public.bill_people (bill_id, id) on delete set null (by_person_id)
);

create index bill_events_bill_id_created_at on public.bill_events (bill_id, created_at desc);
create index bill_events_rate_limit on public.bill_events (bill_id, by_role, created_at);

create table public.expired_bills (
  id text primary key,
  expired_at timestamptz not null default now()
);

create function public.log_events(p_id text, p_events jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.bill_events (bill_id, kind, by_role, by_person_id, by_name, data)
  select p_id, x.kind, x.by_role, x.by_person_id, x.by_name, x.data
  from jsonb_to_recordset(p_events) as x(kind text, by_role text, by_person_id text, by_name text, data jsonb);
$$;

create function public.save_bill(
  p_id text,
  p_version integer,
  p_bill jsonb,
  p_people jsonb,
  p_items jsonb,
  p_shares jsonb,
  p_events jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  new_version integer;
begin
  update public.bills
  set title = p_bill->>'title',
      owner_person_id = p_bill->>'owner_person_id',
      locked = (p_bill->>'locked')::boolean,
      version = version + 1,
      updated_at = now()
  where id = p_id and version = p_version
  returning version into new_version;

  if new_version is null then
    return null;
  end if;

  delete from public.item_shares s
  where s.bill_id = p_id
    and not exists (
      select 1 from jsonb_to_recordset(p_shares) as x(item_id text, person_id text)
      where x.item_id = s.item_id and x.person_id = s.person_id
    );

  delete from public.bill_items i
  where i.bill_id = p_id
    and not exists (select 1 from jsonb_to_recordset(p_items) as x(id text) where x.id = i.id);

  delete from public.bill_people p
  where p.bill_id = p_id
    and not exists (select 1 from jsonb_to_recordset(p_people) as x(id text) where x.id = p.id);

  insert into public.bill_people (bill_id, id, position, name, color, bank, account_no, browser_hash, added_at, details_at)
  select p_id, x.id, x.position, x.name, x.color, x.bank, x.account_no, x.browser_hash, x.added_at, x.details_at
  from jsonb_to_recordset(p_people) as x(
    id text, position integer, name text, color integer, bank text, account_no text,
    browser_hash text, added_at timestamptz, details_at timestamptz
  )
  on conflict (bill_id, id) do update
  set position = excluded.position,
      name = excluded.name,
      color = excluded.color,
      bank = excluded.bank,
      account_no = excluded.account_no,
      browser_hash = excluded.browser_hash,
      added_at = excluded.added_at,
      details_at = excluded.details_at;

  insert into public.bill_items (bill_id, id, position, name, amount_minor, paid_by, browser_hash, added_at)
  select p_id, x.id, x.position, x.name, x.amount_minor, x.paid_by, x.browser_hash, x.added_at
  from jsonb_to_recordset(p_items) as x(
    id text, position integer, name text, amount_minor bigint, paid_by text, browser_hash text, added_at timestamptz
  )
  on conflict (bill_id, id) do update
  set position = excluded.position,
      name = excluded.name,
      amount_minor = excluded.amount_minor,
      paid_by = excluded.paid_by,
      browser_hash = excluded.browser_hash,
      added_at = excluded.added_at;

  insert into public.item_shares (bill_id, item_id, person_id, position, amount_override, browser_hash, joined_at)
  select p_id, x.item_id, x.person_id, x.position, x.amount_override, x.browser_hash, x.joined_at
  from jsonb_to_recordset(p_shares) as x(
    item_id text, person_id text, position integer, amount_override bigint, browser_hash text, joined_at timestamptz
  )
  on conflict (bill_id, item_id, person_id) do update
  set position = excluded.position,
      amount_override = excluded.amount_override,
      browser_hash = excluded.browser_hash,
      joined_at = excluded.joined_at;

  perform public.log_events(p_id, p_events);

  set constraints all immediate;
  return new_version;
end;
$$;

create function public.create_bill(
  p_id text,
  p_bill jsonb,
  p_people jsonb,
  p_items jsonb,
  p_shares jsonb,
  p_events jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.bills (id, title, owner_token_hash, browser_hash, ip_hash, started_at)
  values (
    p_id,
    p_bill->>'title',
    p_bill->>'owner_token_hash',
    p_bill->>'browser_hash',
    p_bill->>'ip_hash',
    (p_bill->>'started_at')::timestamptz
  );
  perform public.save_bill(p_id, 0, p_bill, p_people, p_items, p_shares, p_events);
end;
$$;

create function public.add_payment(p_id text, p_version integer, p_payment jsonb, p_events jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.bills
  set version = version + 1, updated_at = now()
  where id = p_id and version = p_version;

  if not found then
    return false;
  end if;

  insert into public.payments (id, bill_id, from_person, to_person, amount_minor, by_role, browser_hash)
  values (
    (p_payment->>'id')::uuid,
    p_id,
    p_payment->>'from_person',
    p_payment->>'to_person',
    (p_payment->>'amount_minor')::bigint,
    p_payment->>'by_role',
    p_payment->>'browser_hash'
  );

  perform public.log_events(p_id, p_events);
  return true;
end;
$$;

create function public.remove_payment(p_id text, p_payment_id uuid, p_events jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  delete from public.payments where id = p_payment_id and bill_id = p_id;

  if not found then
    return false;
  end if;

  update public.bills set version = version + 1, updated_at = now() where id = p_id;
  perform public.log_events(p_id, p_events);
  return true;
end;
$$;

create function public.delete_old_bills()
returns void
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.bills where expires_at < now() returning id
  ), saved as (
    insert into public.expired_bills (id) select id from gone on conflict (id) do nothing
  )
  delete from public.expired_bills where expired_at < now() - interval '1 year';
$$;

alter table public.bills enable row level security;
alter table public.bill_people enable row level security;
alter table public.bill_items enable row level security;
alter table public.item_shares enable row level security;
alter table public.payments enable row level security;
alter table public.bill_events enable row level security;
alter table public.expired_bills enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

select cron.schedule('splitin-delete-old-bills', '17 3 * * *', 'select public.delete_old_bills()');
