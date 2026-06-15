# 100M — Family & Business Budget App

Personal + business finance tracker for two users, built with Next.js + Supabase.

## Setup

### 1. Supabase
1. Create a new project at supabase.com
2. Go to SQL editor → paste and run `supabase/schema.sql`
3. Copy your Project URL and anon key

### 2. Local development
```bash
npm install
cp .env.local.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
```

### 3. GitHub → Railway deployment
1. Push this repo to GitHub as `100M`
2. Go to railway.app → New project → Deploy from GitHub
3. Select the `100M` repo
4. Add environment variables in Railway:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 4. Invite your spouse
1. You register first at `/register`
2. Your spouse registers with their own email
3. Go to Supabase → SQL editor and run:
   ```sql
   insert into family_members (account_owner_id, member_id)
   values ('your-user-id', 'spouse-user-id');
   ```
   (Get user IDs from Supabase → Authentication → Users)

### 5. Add your accounts
In Supabase SQL editor, add your 4 accounts:
```sql
insert into accounts (user_id, name, type, balance, credit_limit, is_debt, interest_rate, minimum_payment) values
  ('your-user-id', 'Personal Card', 'personal_card', 2500, 10000, true, 24.99, 75),
  ('your-user-id', 'Business Card', 'business_card', 1200, 15000, true, 19.99, 35),
  ('your-user-id', 'Joint Checking', 'joint_account', 8000, null, false, null, null),
  ('your-user-id', 'Office Account', 'office_account', 15000, null, false, null, null);
```

## Features
- Dashboard: monthly income vs expenses, debt status, recent transactions
- Transactions: add manually or filter by account/category/tax type
- Import: upload CSV bank statements → auto-categorize → review → save
- Debt tracker: utilization bar, payoff timeline, payment log
- Report: category breakdown (pie chart), Schedule C business deductions, CSV export for accountant
- PWA: install on phone home screen

## CSV import tips
Works with exports from Chase, Bank of America, Amex, Citi, and most US banks.
Download your statement as CSV from your bank's website, then drag it into the Import page.
