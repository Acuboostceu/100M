-- 100M Budget App — Supabase Schema
-- Run this in your existing Supabase project's SQL editor
-- All tables are prefixed with budget_ to avoid conflicts with other apps

create extension if not exists "uuid-ossp";

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
-- ── Glow (Acupuncture Clinic) ──────────────────────────────────────────────
('Glow — Medical Supplies',        '🪡', 'business', 'Supplies',             '#0ea5e9'),
('Glow — Equipment Purchase',      '🏥', 'business', 'Depreciation',         '#0ea5e9'),
('Glow — Office Rent',             '🏢', 'business', 'Rent or Lease',        '#0ea5e9'),
('Glow — Malpractice Insurance',   '🛡️', 'business', 'Insurance',            '#0ea5e9'),
('Glow — Payroll / Wages',         '👥', 'business', 'Wages',                '#0ea5e9'),
('Glow — Contract Labor (1099)',   '🤝', 'business', 'Contract Labor',       '#0ea5e9'),
('Glow — Meals (Business)',        '🍱', 'business', 'Meals',                '#0ea5e9'),
('Glow — Travel (Business)',       '✈️', 'business', 'Travel',               '#0ea5e9'),
('Glow — Advertising',             '📢', 'business', 'Advertising',          '#0ea5e9'),
('Glow — Legal & Accounting',      '⚖️', 'business', 'Legal & Professional', '#0ea5e9'),
('Glow — CEU / License Fees',      '📜', 'business', 'Other Expenses',       '#0ea5e9'),
('Glow — Software / EHR',          '💻', 'business', 'Office Expense',       '#0ea5e9'),
('Glow — Utilities',               '💡', 'business', 'Utilities',            '#0ea5e9'),
('Glow — Uniforms / Scrubs',       '👔', 'business', 'Other Expenses',       '#0ea5e9'),
('Glow — Car (Business)',          '🚗', 'business', 'Car & Truck',          '#0ea5e9'),
('Glow — Office Supplies',         '📎', 'business', 'Office Expense',       '#0ea5e9'),
-- ── Acuboost (Web/Tech) ────────────────────────────────────────────────────
('Acuboost — Hosting & Infra',     '🖥️', 'business', 'Office Expense',       '#8b5cf6'),
('Acuboost — Domain & DNS',        '🌐', 'business', 'Office Expense',       '#8b5cf6'),
('Acuboost — Software / Dev Tools','🛠️', 'business', 'Office Expense',       '#8b5cf6'),
('Acuboost — Contract Developer',  '👨‍💻','business', 'Contract Labor',       '#8b5cf6'),
('Acuboost — Marketing / Ads',     '📢', 'business', 'Advertising',          '#8b5cf6'),
('Acuboost — Legal & Accounting',  '⚖️', 'business', 'Legal & Professional', '#8b5cf6'),
('Acuboost — Equipment',           '💻', 'business', 'Depreciation',         '#8b5cf6'),
('Acuboost — Meals (Business)',    '🍱', 'business', 'Meals',                '#8b5cf6'),
('Acuboost — Travel (Business)',   '✈️', 'business', 'Travel',               '#8b5cf6'),
('Acuboost — Home Office',         '🏠', 'business', 'Other Expenses',       '#8b5cf6'),
('Acuboost — Courses & Books',     '📚', 'business', 'Other Expenses',       '#8b5cf6'),
-- ── Personal ───────────────────────────────────────────────────────────────
('Personal — Rent / Mortgage',     '🏠', 'personal', null, '#10b981'),
('Personal — Utilities',           '💡', 'personal', null, '#10b981'),
('Personal — Groceries',           '🛒', 'personal', null, '#10b981'),
('Personal — Dining Out',          '🍽️', 'personal', null, '#10b981'),
('Personal — Gas & Fuel',          '⛽', 'personal', null, '#10b981'),
('Personal — Car Payment',         '🚗', 'personal', null, '#10b981'),
('Personal — Car Maintenance',     '🔧', 'personal', null, '#10b981'),
('Personal — Health Insurance',    '🏥', 'personal', null, '#10b981'),
('Personal — Medical / Dental',    '💊', 'personal', null, '#10b981'),
('Personal — Pharmacy',            '💊', 'personal', null, '#10b981'),
('Personal — Life Insurance',      '🛡️', 'personal', null, '#10b981'),
('Personal — Auto Insurance',      '🚘', 'personal', null, '#10b981'),
('Personal — Entertainment',       '🎬', 'personal', null, '#10b981'),
('Personal — Subscriptions',       '📱', 'personal', null, '#10b981'),
('Personal — Shopping / Clothing', '🛍️', 'personal', null, '#10b981'),
('Personal — Personal Care',       '💄', 'personal', null, '#10b981'),
('Personal — Education',           '📚', 'personal', null, '#10b981'),
('Personal — Donations',           '💝', 'personal', null, '#10b981'),
('Personal — Gifts',               '🎁', 'personal', null, '#10b981'),
('Personal — Travel',              '✈️', 'personal', null, '#10b981'),
('Personal — Bank Fees',           '🏦', 'personal', null, '#10b981'),
('Personal — Other',               '📌', 'personal', null, '#10b981'),
-- ── Income ─────────────────────────────────────────────────────────────────
('Income — Glow (Acupuncture)',    '💚', 'none', null, '#22c55e'),
('Income — Acuboost (Web)',        '💜', 'none', null, '#22c55e'),
('Income — Salary / W-2',         '💵', 'none', null, '#22c55e'),
('Income — Refund',                '↩️', 'none', null, '#22c55e'),
('Income — Other',                 '💰', 'none', null, '#22c55e');

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
