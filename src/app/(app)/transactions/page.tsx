import { createClient } from '@/lib/supabase/server'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage() {
  const supabase = await createClient()

  const [{ data: transactions }, { data: accounts }, { data: categories }] = await Promise.all([
    supabase.from('budget_transactions')
      .select('*, category:budget_categories(*), account:budget_accounts(*)')
      .order('date', { ascending: false })
      .limit(200),
    supabase.from('budget_accounts').select('*').order('type'),
    supabase.from('budget_categories').select('*').order('name'),
  ])

  return (
    <TransactionsClient
      transactions={transactions ?? []}
      accounts={accounts ?? []}
      categories={categories ?? []}
    />
  )
}
