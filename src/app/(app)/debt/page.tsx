import { createClient } from '@/lib/supabase/server'
import DebtClient from './DebtClient'

export default async function DebtPage() {
  const supabase = await createClient()

  const [{ data: debtAccounts }, { data: payments }] = await Promise.all([
    supabase.from('budget_accounts').select('*').eq('is_debt', true).order('balance', { ascending: false }),
    supabase.from('budget_debt_payments').select('*, account:budget_accounts(name)').order('payment_date', { ascending: false }).limit(50),
  ])

  return <DebtClient debtAccounts={debtAccounts ?? []} payments={payments ?? []} />
}
