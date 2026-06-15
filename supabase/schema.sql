-- 100M Budget App — Supabase Schema
-- Run this in your existing Supabase project's SQL editor
-- All tables are prefixed with budget_ to avoid conflicts with other apps

create extension if not exists "uuid-ossp";

-- ─── Accounts ────────────────────────────────────────────────────────────────
create table budget_accounts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users not null,
  name          text not null,
  type          text not null check (type in ('personal_card','business_card','joint_account','office_account')),
  balance       numeric(12,2) not null default 0,
  credit_limit  numeric(12,2),
  is_debt       boolean not null default false,
  interest_rate numeric(5,2),
  minimum_payment numeric(12,2),
  created_at    timestamptz default now()
);
alter table budget_accounts enable row level security;
create policy "family members access" on budget_accounts
  using (auth.uid() = user_id or exists (
    select 1 from budget_family_members fm where fm.account_owner_id = user_id and fm.member_id = auth.uid()
  ));

-- ─── Family members (shared access between spouses) ──────────────────────────
create table budget_family_members (
  id               uuid primary key default uuid_generate_v4(),
  account_owner_id uuid references auth.users not null,
  member_id        uuid references auth.users not null,
  created_at       timestamptz default now(),
  unique(account_owner_id, member_id)
);
alter table budget_family_members enable row level security;
create policy "own family" on budget_family_members
  using (auth.uid() = account_owner_id or auth.uid() = member_id);

-- ─── Categories ──────────────────────────────────────────────────────────────
create table budget_categories (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  icon         text not null default '💰',
  tax_type     text not null check (tax_type in ('personal','business','none')) default 'none',
  irs_category text,
  color        text not null default '#6b7280'
);

insert into budget_categories (name, icon, tax_type, irs_category, color) values
  ('Groceries',       '🛒', 'personal', null,                    '#10b981'),
  ('Dining out',      '🍽️', 'personal', null,                    '#f59e0b'),
  ('Meals (business)','🍱', 'business', 'Meals & Entertainment',  '#f59e0b'),
  ('Gas',             '⛽', 'personal', null,                    '#6366f1'),
  ('Car (business)',  '🚗', 'business', 'Car & Truck expenses',   '#6366f1'),
  ('Travel',          '✈️', 'business', 'Travel',                '#0ea5e9'),
  ('Office supplies', '📎', 'business', 'Office expense',         '#8b5cf6'),
  ('Utilities',       '💡', 'personal', null,                    '#ec4899'),
  ('Rent/Mortgage',   '🏠', 'personal', null,                    '#14b8a6'),
  ('Insurance',       '🛡️', 'personal', null,                    '#64748b'),
  ('Medical',         '💊', 'personal', null,                    '#ef4444'),
  ('Education',       '📚', 'personal', null,                    '#a855f7'),
  ('Entertainment',   '🎬', 'personal', null,                    '#f97316'),
  ('Shopping',        '🛍️', 'personal', null,                    '#ec4899'),
  ('Payroll',         '👥', 'business', 'Wages',                  '#10b981'),
  ('Marketing',       '📢', 'business', 'Advertising',            '#f59e0b'),
  ('Software/SaaS',   '💻', 'business', 'Office expense',         '#6366f1'),
  ('Professional fees','⚖️','business', 'Legal & professional',   '#8b5cf6'),
  ('Salary/Income',   '💵', 'none',     null,                    '#22c55e'),
  ('Business income', '📈', 'none',     null,                    '#22c55e'),
  ('Other',           '📌', 'none',     null,                    '#6b7280');

-- ─── Transactions ─────────────────────────────────────────────────────────────
create table budget_transactions (
  id           uuid primary key default uuid_generate_v4(),
  account_id   uuid references budget_accounts not null,
  category_id  uuid references budget_categories,
  amount       numeric(12,2) not null,
  type         text not null check (type in ('expense','income','transfer')) default 'expense',
  description  text not null,
  date         date not null,
  entered_by   uuid references auth.users not null,
  tax_type     text check (tax_type in ('personal','business','none')) default 'none',
  irs_category text,
  notes        text,
  created_at   timestamptz default now()
);
alter table budget_transactions enable row level security;
create policy "family transactions" on budget_transactions
  using (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_transactions.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );

create index on budget_transactions (account_id);
create index on budget_transactions (date desc);
create index on budget_transactions (category_id);

-- ─── Debt payments ───────────────────────────────────────────────────────────
create table budget_debt_payments (
  id           uuid primary key default uuid_generate_v4(),
  account_id   uuid references budget_accounts not null,
  amount       numeric(12,2) not null,
  payment_date date not null,
  notes        text,
  created_at   timestamptz default now()
);
alter table budget_debt_payments enable row level security;
create policy "family debt payments" on budget_debt_payments
  using (
    exists (
      select 1 from budget_accounts a
      where a.id = budget_debt_payments.account_id
        and (a.user_id = auth.uid() or exists (
          select 1 from budget_family_members fm where fm.account_owner_id = a.user_id and fm.member_id = auth.uid()
        ))
    )
  );

-- ─── Monthly budgets ─────────────────────────────────────────────────────────
create table budget_monthly_budgets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users not null,
  category_id uuid references budget_categories not null,
  month       text not null,
  amount      numeric(12,2) not null,
  created_at  timestamptz default now(),
  unique(user_id, category_id, month)
);
alter table budget_monthly_budgets enable row level security;
create policy "own budgets" on budget_monthly_budgets using (auth.uid() = user_id);

-- ─── Useful view ─────────────────────────────────────────────────────────────
create view budget_monthly_summary as
select
  date_trunc('month', t.date)::date as month,
  a.type as account_type,
  c.tax_type,
  c.irs_category,
  c.name as category_name,
  sum(case when t.type = 'expense' then t.amount else 0 end) as total_expense,
  sum(case when t.type = 'income'  then t.amount else 0 end) as total_income,
  count(*) as tx_count
from budget_transactions t
join budget_accounts a on a.id = t.account_id
left join budget_categories c on c.id = t.category_id
group by 1, 2, 3, 4, 5;
