import { createClient } from '@/lib/supabase/server'
import ReportClient from './ReportClient'

export default async function ReportPage() {
  const supabase = await createClient()

  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const startDate = months[months.length - 1] + '-01'
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('budget_transactions')
    .select('*, category:budget_categories(*), account:budget_accounts(*)')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('type', 'expense')

  return <ReportClient transactions={transactions ?? []} months={months} currentMonth={months[0]} />
}
