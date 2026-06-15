import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const startOfMonth = `${monthStr}-01`
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: accounts }, { data: transactions }, { data: debts }] = await Promise.all([
    supabase.from('budget_accounts').select('*').order('type'),
    supabase.from('budget_transactions')
      .select('*, category:budget_categories(*), account:budget_accounts(*)')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false }),
    supabase.from('budget_accounts').select('*').eq('is_debt', true),
  ])

  const totalIncome = (transactions ?? [])
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)

  const totalExpense = (transactions ?? [])
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

  const totalDebt = (debts ?? []).reduce((s, a) => s + Number(a.balance), 0)

  return (
    <DashboardClient
      accounts={accounts ?? []}
      recentTransactions={(transactions ?? []).slice(0, 8)}
      totalIncome={totalIncome}
      totalExpense={totalExpense}
      totalDebt={totalDebt}
      monthStr={monthStr}
      userName={user?.email?.split('@')[0] ?? 'User'}
    />
  )
}
