-- 100M v2 Migration
-- Run this in Supabase SQL editor AFTER the existing schema.sql

-- ── Add entity, owner, institution columns to accounts ─────────────────────
alter table budget_accounts
  add column if not exists entity      text check (entity in ('glow','acuboost','personal')) default 'personal',
  add column if not exists owner       text check (owner in ('jiyeon','husband','joint')) default 'joint',
  add column if not exists institution text check (institution in ('boa','chase','citi','amex','capital_one','other')) default 'other';

-- ── Statements table ────────────────────────────────────────────────────────
create table if not exists budget_statements (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid references budget_accounts not null,
  period      text not null,  -- 'YYYY-MM'
  filename    text,
  status      text not null check (status in ('pending','confirmed')) default 'pending',
  tx_count    int not null default 0,
  total_in    numeric(12,2) not null default 0,
  total_out   numeric(12,2) not null default 0,
  created_at  timestamptz default now(),
  unique(account_id, period)
);
alter table budget_statements enable row level security;
create policy "family statements" on budget_statements
  using (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_statements.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm
          where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );
create policy "family statements insert" on budget_statements for insert
  with check (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_statements.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm
          where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );
create policy "family statements update" on budget_statements for update
  using (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_statements.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm
          where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );
create policy "family statements delete" on budget_statements for delete
  using (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_statements.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm
          where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );

-- ── Add statement_id to transactions ────────────────────────────────────────
alter table budget_transactions
  add column if not exists statement_id uuid references budget_statements on delete cascade;
create index if not exists budget_transactions_statement_id on budget_transactions (statement_id);

-- ── Import rules: ensure entity column + unique constraint ──────────────────
alter table budget_import_rules
  add column if not exists entity text check (entity in ('glow','acuboost','personal'));
-- Drop old unique on keyword alone if exists, add composite unique
do $$ begin
  if exists (
    select 1 from pg_constraint where conname = 'budget_import_rules_keyword_key'
  ) then
    alter table budget_import_rules drop constraint budget_import_rules_keyword_key;
  end if;
end $$;
alter table budget_import_rules
  drop constraint if exists budget_import_rules_keyword_entity_key;
alter table budget_import_rules
  add constraint budget_import_rules_keyword_entity_key unique (keyword, entity);

-- ── Family members: add insert policy if missing ────────────────────────────
create policy if not exists "insert family" on budget_family_members
  for insert with check (auth.uid() = account_owner_id);
