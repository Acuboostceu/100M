'use client'
import { useState } from 'react'
import { Transaction, Category, Entity } from '@/lib/types'
import Link from 'next/link'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmtExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const ENTITY_CONFIG = {
  glow:     { label: 'Glow',     color: 'text-sky-600',     subtitle: 'S-Corp · Form 1120-S' },
  acuboost: { label: 'Acuboost', color: 'text-violet-600',  subtitle: 'LLC · Schedule C' },
  personal: { label: 'Personal', color: 'text-emerald-600', subtitle: 'Personal Finances' },
}

export default function ReportClient({
  entity, year, transactions, categories,
}: {
  entity: Entity
  year: number
  transactions: Transaction[]
  categories: Category[]
}) {
  const [view, setView] = useState<'summary' | 'detail'>('summary')
  const cfg = ENTITY_CONFIG[entity]

  // Build monthly data
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    const txs = transactions.filter(t => t.date.startsWith(month))
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { month, income, expense, net: income - expense, txCount: txs.length }
  })

  const totalIncome  = monthly.reduce((s, m) => s + m.income,  0)
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0)
  const totalNet     = totalIncome - totalExpense

  // Category breakdown (expenses)
  const expTxs = transactions.filter(t => t.type === 'expense')
  const catBreakdown = Object.values(
    expTxs.reduce((acc, t) => {
      const cat = (t as any).category
      const key = t.category_id || '__none__'
      const irsKey = cat?.irs_category || 'Other'
      if (!acc[key]) acc[key] = {
        icon: cat?.icon ?? '📌',
        name: cat?.name?.split(' — ')[1] ?? cat?.name ?? 'Uncategorized',
        irsCategory: irsKey,
        amount: 0,
        count: 0,
      }
      acc[key].amount += Number(t.amount)
      acc[key].count  += 1
      return acc
    }, {} as Record<string, { icon: string; name: string; irsCategory: string; amount: number; count: number }>)
  ).sort((a, b) => b.amount - a.amount)

  // IRS category grouping (for business entities)
  const irsGroups = Object.entries(
    expTxs.reduce((acc, t) => {
      const irsKey = (t as any).category?.irs_category || 'Other / Uncategorized'
      acc[irsKey] = (acc[irsKey] ?? 0) + Number(t.amount)
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  function exportCSV() {
    const rows = [
      ['Date', 'Description', 'Amount', 'Type', 'Category', 'IRS Category'],
      ...transactions
        .filter(t => t.type !== 'transfer')
        .map(t => [
          t.date,
          t.description,
          t.type === 'expense' ? `-${t.amount}` : String(t.amount),
          t.type,
          (t as any).category?.name ?? '',
          (t as any).category?.irs_category ?? '',
        ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entity}_${year}_report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div>
        <Link href={`/${entity}`} className="text-xs text-gray-400 hover:text-gray-600 mb-2 inline-block">← Back</Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-bold ${cfg.color}`}>{cfg.label} — {year}</h1>
            <p className="text-xs text-gray-400">{cfg.subtitle}</p>
          </div>
          <button onClick={exportCSV}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0">
            Export CSV ↓
          </button>
        </div>
      </div>

      {/* Annual totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Income',   value: totalIncome,  cls: 'text-green-600' },
          { label: 'Total Expenses', value: totalExpense, cls: 'text-red-500' },
          { label: 'Net',            value: totalNet,     cls: totalNet >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.cls}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['summary', 'detail'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
              view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {view === 'summary' && (
        <>
          {/* Monthly table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monthly Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Month</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Income</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Expenses</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthly.map((m, i) => (
                  <tr key={i} className={m.txCount === 0 ? 'opacity-30' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{MONTHS[i]}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{m.income > 0 ? fmt(m.income) : '–'}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{m.expense > 0 ? fmt(m.expense) : '–'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.net >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {m.txCount > 0 ? fmt(m.net) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-gray-800">TOTAL</td>
                  <td className="px-4 py-3 text-right text-green-600">{fmt(totalIncome)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{fmt(totalExpense)}</td>
                  <td className={`px-4 py-3 text-right ${totalNet >= 0 ? 'text-gray-800' : 'text-red-500'}`}>{fmt(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expense categories */}
          {catBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Expenses by Category</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {catBreakdown.map((row, i) => {
                  const pct = totalExpense > 0 ? (row.amount / totalExpense * 100).toFixed(0) : '0'
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base">{row.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{row.name}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                          <div className="bg-red-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                      <span className="text-sm font-semibold text-gray-800 shrink-0 w-24 text-right">{fmtExact(row.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* IRS / Schedule C grouping (business only) */}
          {entity !== 'personal' && irsGroups.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {entity === 'glow' ? 'Form 1120-S' : 'Schedule C'} — Deductions Summary
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {irsGroups.map(([label, amount], i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className="text-sm font-semibold text-gray-800">{fmtExact(amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 font-bold border-t border-gray-200">
                  <span className="text-sm text-gray-800">Total Deductions</span>
                  <span className="text-sm text-red-600">{fmtExact(totalExpense)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 px-4 pb-3">
                Provide this summary to your accountant along with the CSV export.
              </p>
            </div>
          )}
        </>
      )}

      {view === 'detail' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All Transactions</h2>
            <span className="text-xs text-gray-400">{transactions.filter(t => t.type !== 'transfer').length} records</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
            {transactions.filter(t => t.type !== 'transfer').map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base shrink-0">{(t as any).category?.icon ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.date} · {(t as any).category?.name?.split(' — ')[1] ?? 'Uncategorized'}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmtExact(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
