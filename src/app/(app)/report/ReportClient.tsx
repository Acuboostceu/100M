'use client'
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#0ea5e9','#a855f7','#ec4899','#14b8a6','#f97316','#64748b']

export default function ReportClient({ transactions, months, currentMonth }: {
  transactions: any[]
  months: string[]
  currentMonth: string
}) {
  const [month, setMonth] = useState(currentMonth)
  const [view, setView] = useState<'all' | 'personal' | 'business'>('all')

  const filtered = transactions.filter(t => {
    if (!t.date.startsWith(month)) return false
    if (view === 'personal' && t.tax_type !== 'personal') return false
    if (view === 'business' && t.tax_type !== 'business') return false
    return true
  })

  const byCategory: Record<string, { name: string; icon: string; total: number; irs?: string }> = {}
  filtered.forEach(t => {
    const cat = t.category?.name ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = { name: cat, icon: t.category?.icon ?? '📌', total: 0, irs: t.category?.irs_category }
    byCategory[cat].total += Number(t.amount)
  })

  const categories = Object.values(byCategory).sort((a, b) => b.total - a.total)
  const total = categories.reduce((s, c) => s + c.total, 0)

  // IRS summary for tax export
  const irsGroups: Record<string, number> = {}
  filtered.filter(t => t.tax_type === 'business' && t.category?.irs_category).forEach(t => {
    const k = t.category.irs_category
    irsGroups[k] = (irsGroups[k] ?? 0) + Number(t.amount)
  })

  function exportCSV() {
    const header = 'Date,Description,Amount,Category,IRS Category,Tax Type,Account\n'
    const rows = filtered.map(t =>
      [t.date, `"${t.description}"`, t.amount, t.category?.name ?? '', t.category?.irs_category ?? '', t.tax_type, t.account?.name ?? ''].join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `100M-${month}-${view}.csv`; a.click()
  }

  const monthLabel = (m: string) => new Date(m + '-02').toLocaleString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Monthly report</h1>
        <button onClick={exportCSV} className="btn-secondary text-xs">⬇️ Export CSV</button>
      </div>

      {/* Controls */}
      <div className="card flex flex-wrap gap-3 items-center">
        <select className="input w-auto" value={month} onChange={e => setMonth(e.target.value)}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <div className="flex gap-1">
          {(['all','personal','business'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                view === v ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-sm font-semibold text-gray-700 ml-auto">{fmt(total)} total</span>
      </div>

      {/* Pie chart */}
      {categories.length > 0 && (
        <div className="card">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categories.map(c => ({ name: c.name, value: c.total }))}
                cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      <div className="card divide-y divide-gray-50">
        {categories.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3 py-2.5">
            <span className="text-lg">{c.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{c.name}</span>
                <span className="font-semibold">{fmt(c.total)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c.total / total) * 100}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              {c.irs && <p className="text-xs text-violet-500 mt-0.5">IRS: {c.irs}</p>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{((c.total / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No expenses this month</p>
        )}
      </div>

      {/* Tax export summary */}
      {Object.keys(irsGroups).length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3">Business deductions (Schedule C)</h2>
          <div className="divide-y divide-gray-50">
            {Object.entries(irsGroups).map(([cat, total]) => (
              <div key={cat} className="flex justify-between py-2 text-sm">
                <span className="text-violet-600">{cat}</span>
                <span className="font-semibold">{fmt(total)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 text-sm font-bold">
              <span>Total deductions</span>
              <span>{fmt(Object.values(irsGroups).reduce((s, v) => s + v, 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
