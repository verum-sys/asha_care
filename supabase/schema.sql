-- DiagNXT CareLink: Supabase schema (prototype).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Model: each app record is stored whole in `data` (jsonb), with a few columns lifted out for
-- querying. Ownership rule from the app is kept on the server:
--   * the field device owns `data` (patient, referral details, `worker` facts)
--   * the facility owns `facility` (a separate column on referrals the field device never sends)
-- Conflicts are last-write-wins on the client's `updated_at`; a stale write is ignored.
-- `server_updated_at` is set by the server on every write and is what devices use as the pull cursor.

create table if not exists public.patients (
  id                text primary key,
  data              jsonb       not null,
  updated_at        timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  created_by        text        default (auth.jwt() ->> 'sub')
);

create table if not exists public.referrals (
  id                text primary key,
  patient_id        text        not null,
  tier              text        not null default 'asha',
  urgency           text,
  data              jsonb       not null,
  facility          jsonb       not null default
    '{"response":"none","attendance":"unknown","completed":false,"followUpRequired":false,"notes":[]}'::jsonb,
  updated_at        timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  created_by        text        default (auth.jwt() ->> 'sub')
);

create table if not exists public.followups (
  id                text primary key,
  referral_id       text        not null,
  at                timestamptz not null,
  data              jsonb       not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  created_by        text        default (auth.jwt() ->> 'sub')
);

create table if not exists public.facility_events (
  id                text primary key,
  referral_id       text        not null,
  at                timestamptz not null,
  data              jsonb       not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  created_by        text        default (auth.jwt() ->> 'sub')
);

create index if not exists patients_cursor_idx        on public.patients        (server_updated_at, id);
create index if not exists referrals_cursor_idx       on public.referrals       (server_updated_at, id);
create index if not exists referrals_tier_idx         on public.referrals       (tier);
create index if not exists referrals_patient_idx      on public.referrals       (patient_id);
create index if not exists followups_cursor_idx       on public.followups       (server_updated_at, id);
create index if not exists followups_referral_idx     on public.followups       (referral_id);
create index if not exists facility_events_cursor_idx on public.facility_events (server_updated_at, id);
create index if not exists facility_events_ref_idx    on public.facility_events (referral_id);

-- ---------------------------------------------------------------------------------------------
-- Write guard: stamp server time, ignore stale writes, reset facility facts when the tier changes.
-- ---------------------------------------------------------------------------------------------
create or replace function public.carelink_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Last write wins on the client clock. Returning NULL skips the stale update without an error.
    if tg_table_name in ('patients', 'referrals') and new.updated_at < old.updated_at then
      return null;
    end if;
    -- A referral moving to another tier starts with fresh facility facts.
    if tg_table_name = 'referrals' and new.tier is distinct from old.tier then
      new.facility := '{"response":"none","attendance":"unknown","completed":false,"followUpRequired":false,"notes":[]}'::jsonb;
    end if;
    -- created_by never changes after insert.
    new.created_by := old.created_by;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists carelink_guard on public.patients;
create trigger carelink_guard before insert or update on public.patients
  for each row execute function public.carelink_guard();
drop trigger if exists carelink_guard on public.referrals;
create trigger carelink_guard before insert or update on public.referrals
  for each row execute function public.carelink_guard();
drop trigger if exists carelink_guard on public.followups;
create trigger carelink_guard before insert or update on public.followups
  for each row execute function public.carelink_guard();
drop trigger if exists carelink_guard on public.facility_events;
create trigger carelink_guard before insert or update on public.facility_events
  for each row execute function public.carelink_guard();

-- ---------------------------------------------------------------------------------------------
-- Row level security.
-- PROTOTYPE POLICY: any signed-in user (a valid Clerk token) can read and write every row.
-- Before real patient data goes in, replace these with per-tier / per-facility policies
-- (for example a role claim in the Clerk token) and add an audit trail.
-- ---------------------------------------------------------------------------------------------
alter table public.patients        enable row level security;
alter table public.referrals       enable row level security;
alter table public.followups       enable row level security;
alter table public.facility_events enable row level security;

revoke all on public.patients, public.referrals, public.followups, public.facility_events from anon;
grant select, insert, update on public.patients, public.referrals, public.followups, public.facility_events to authenticated;

drop policy if exists carelink_authenticated on public.patients;
create policy carelink_authenticated on public.patients        for all to authenticated using (true) with check (true);
drop policy if exists carelink_authenticated on public.referrals;
create policy carelink_authenticated on public.referrals       for all to authenticated using (true) with check (true);
drop policy if exists carelink_authenticated on public.followups;
create policy carelink_authenticated on public.followups       for all to authenticated using (true) with check (true);
drop policy if exists carelink_authenticated on public.facility_events;
create policy carelink_authenticated on public.facility_events for all to authenticated using (true) with check (true);
