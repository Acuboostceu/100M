import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ENTITIES = [
  { key: 'glow',      label: 'Glow',      icon: '🏥', href: '/glow',      color: 'border-sky-200 bg-sky-50' },
  { key: 'acuboost',  label: 'Acuboost',  icon: '💻', href: '/acuboost',  color: 'border-violet-200 bg-violet-50' },
  { key: 'personal',  label: 'Personal',  icon: '🏠', href: '/personal',  color: 'border-emerald-200 bg-emerald-50' },
] as const

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const start = `${monthStr}-01`
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const { data: txs } = await supabase
    .from('budget_transactions')
    .select('*, account:budget_accounts(entity)')
    .gte('date', start).lte('date', end)

  const all = txs ?? []
  const totalIncome  = all.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = all.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = totalIncome - totalExpense

  const { data: debts } = await supabase.from('budget_accounts').select('balance').eq('is_debt', true)
  const totalDebt = (debts ?? []).reduce((s, a) => s + Number(a.balance), 0)

  const entitySummary = (entity: string) => {
    const rows = all.filter((t: any) => t.account?.entity === entity)
    return {
      income:  rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    }
  }

  const userName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hi {userName} 👋</h1>
        <p className="text-sm text-gray-400">{monthLabel}</p>
      </div>

      {/* Combined summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Income',     value: totalIncome,  cls: 'text-green-600' },
          { label: 'Expenses',   value: totalExpense, cls: 'text-red-500' },
          { label: 'Net',        value: net,          cls: net >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Total Debt', value: totalDebt,    cls: 'text-orange-500' },
        ].map(c => (
          <div key={c.label} className="card">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.cls}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Entity cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ENTITIES.map(e => {
          const s = entitySummary(e.key)
          const eNet = s.income - s.expense
          return (
            <Link key={e.key} href={e.href}
              className={`card border-2 ${e.color} hover:shadow-md transition-shadow block`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{e.icon}</span>
                <span className="font-semibold text-gray-800">{e.label}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Income</span>
                  <span className="font-medium text-green-600">{fmt(s.income)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expenses</span>
                  <span className="font-medium text-red-500">{fmt(s.expense)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-500">Net</span>
                  <span className={`font-bold ${eNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(eNet)}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
