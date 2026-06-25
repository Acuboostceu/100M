'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, Category, Statement, ImportRule } from '@/lib/types'
import { suggestKeyword } from '@/lib/parsers'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function StatementClient({
  statement,
  transactions: initialTxs,
  categories,
  rules: initialRules,
}: {
  statement: Statement
  transactions: Transaction[]
  categories: Category[]
  rules: ImportRule[]
}) {
  const sb = createClient()
  const [txs, setTxs] = useState(initialTxs)
  const [rules, setRules] = useState(initialRules)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<{ id: string; keyword: string } | null>(null)
  const [savedRuleKws, setSavedRuleKws] = useState<Set<string>>(new Set(initialRules.map(r => r.keyword)))
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(statement.status === 'confirmed')
  const [applyAll, setApplyAll] = useState<{ desc: string; category_id: string; count: number } | null>(null)

  const entity = (statement.account as any)?.entity ?? 'personal'
  const catsByEntity = categories.filter(c => {
    if (entity === 'glow')     return c.name.startsWith('Glow') || c.name.startsWith('Income')
    if (entity === 'acuboost') return c.name.startsWith('Acuboost') || c.name.startsWith('Income')
    return !c.name.startsWith('Glow') && !c.name.startsWith('Acuboost')
  })

  const expenses = txs.filter(t => t.type === 'expense')
  const income   = txs.filter(t => t.type === 'income')
  const transfers = txs.filter(t => t.type === 'transfer')
  const totalIn  = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = expenses.reduce((s, t) => s + Number(t.amount), 0)
  const uncatCount = txs.filter(t => t.type !== 'transfer' && !t.category_id).length

  // Category breakdown for expenses
  const catBreakdown = Object.values(
    expenses.reduce((acc, t) => {
      const key = t.category_id || '__none__'
      if (!acc[key]) acc[key] = {
        icon: (t as any).category?.icon ?? '📌',
        name: (t as any).category?.name?.split(' — ')[1] ?? (t as any).category?.name ?? 'Uncategorized',
        amount: 0, count: 0,
      }
      acc[key].amount += Number(t.amount)
      acc[key].count  += 1
      return acc
    }, {} as Record<string, { icon: string; name: string; amount: number; count: number }>)
  ).sort((a, b) => b.amount - a.amount)

  async function updateCategory(id: string, category_id: string) {
    const cat = categories.find(c => c.id === category_id)
    await sb.from('budget_transactions').update({
      category_id: category_id || null,
      tax_type: cat?.tax_type ?? 'none',
      irs_category: cat?.irs_category ?? null,
    }).eq('id', id)

    const tx = txs.find(t => t.id === id)
    setTxs(ts => ts.map(t => t.id === id
      ? { ...t, category_id, category: cat } as any : t))
    setEditingId(null)

    if (tx && category_id) {
      const others = txs.filter(t => t.id !== id && t.description === tx.description && t.category_id !== category_id)
      if (others.length > 0) setApplyAll({ desc: tx.description, category_id, count: others.length })
    }
  }

  async function doApplyAll() {
    if (!applyAll) return
    const cat = categories.find(c => c.id === applyAll.category_id)
    const ids = txs.filter(t => t.description === applyAll.desc && t.category_id !== applyAll.category_id).map(t => t.id)
    await sb.from('budget_transactions').update({
      category_id: applyAll.category_id,
      tax_type: cat?.tax_type ?? 'none',
      irs_category: cat?.irs_category ?? null,
    }).in('id', ids)
    setTxs(ts => ts.map(t => ids.includes(t.id) ? { ...t, category_id: applyAll.category_id, category: cat } as any : t))
    setApplyAll(null)
  }

  async function saveRule(keyword: string, category_id: string) {
    if (!keyword.trim() || !category_id) return
    const kw = keyword.toLowerCase().trim()
    await sb.from('budget_import_rules').upsert(
      { keyword: kw, entity, category_id },
      { onConflict: 'keyword,entity' }
    )
    setSavedRuleKws(s => new Set(s).add(kw))
    setRules(r => [...r.filter(x => x.keyword !== kw), { id: '', keyword: kw, entity, category_id, created_at: '' }])
    setEditingRule(null)
  }

  async function confirmStatement() {
    setConfirming(true)
    await sb.from('budget_statements').update({ status: 'confirmed' }).eq('id', statement.id)
    setConfirmed(true)
    setConfirming(false)
  }

  const period = new Date(statement.period + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const entityPath = `/${entity}`

  return (
    <div className="space-y-5 pb-10">
      {/* Back + header */}
      <div>
        <Link href={entityPath} className="text-xs text-gray-400 hover:text-gray-600 mb-2 inline-block">← Back</Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{(statement.account as any)?.name}</h1>
            <p className="text-sm text-gray-400">{period}</p>
          </div>
          {confirmed ? (
            <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">✓ Confirmed</span>
          ) : (
            <button
              onClick={confirmStatement}
              disabled={confirming || uncatCount > 0}
              title={uncatCount > 0 ? `${uncatCount} transactions still uncategorized` : ''}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 shrink-0">
              {confirming ? 'Saving…' : 'Confirm ✓'}
            </button>
          )}
        </div>
        {uncatCount > 0 && (
          <p className="text-xs text-amber-500 mt-1">{uncatCount} transactions need a category before confirming</p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Income',   value: totalIn,         cls: 'text-green-600' },
          { label: 'Expenses', value: totalOut,         cls: 'text-red-500' },
          { label: 'Net',      value: totalIn - totalOut, cls: totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-base font-bold ${c.cls}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Expense Breakdown</h2>
          <div className="space-y-0">
            {catBreakdown.map((row, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                <span className="text-base">{row.icon}</span>
                <span className="text-sm text-gray-700 flex-1">{row.name}</span>
                <span className="text-xs text-gray-400">{row.count}×</span>
                <span className="text-sm font-semibold text-gray-800">{fmtExact(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply-all banner */}
      {applyAll && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-blue-800">
            Apply same category to <strong>{applyAll.count}</strong> other "{applyAll.desc}" transactions?
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={doApplyAll} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white">Apply all</button>
            <button onClick={() => setApplyAll(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200">Skip</button>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transactions</h2>
          <span className="text-xs text-gray-400">{txs.length} total</span>
        </div>
        <div className="divide-y divide-gray-50">
          {txs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No transactions</p>
          )}
          {txs.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg shrink-0">{(t as any).category?.icon ?? (t.type === 'transfer' ? '↔' : '📌')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-800">{t.description}</p>
                <p className="text-xs text-gray-400">{t.date}</p>
                {/* Category selector */}
                {t.type !== 'transfer' && (
                  editingId === t.id ? (
                    <select autoFocus
                      className="mt-1 text-xs border border-blue-300 rounded-lg px-2 py-0.5 w-full max-w-[260px]"
                      value={t.category_id ?? ''}
                      onChange={e => updateCategory(t.id, e.target.value)}
                      onBlur={() => setEditingId(null)}>
                      <option value="">Uncategorized</option>
                      {catsByEntity.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name.split(' — ')[1] ?? c.name}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditingId(t.id)}
                      className={`text-xs mt-0.5 transition-colors ${t.category_id ? 'text-gray-400 hover:text-blue-600' : 'text-amber-500 hover:text-amber-700 font-medium'}`}>
                      {(t as any).category?.name?.split(' — ')[1] ?? (t as any).category?.name ?? '⚠ Uncategorized'} ✏️
                    </button>
                  )
                )}
              </div>

              {/* Save-as-rule */}
              {t.type !== 'transfer' && (
                editingRule?.id === t.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input autoFocus className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-24"
                      value={editingRule.keyword}
                      onChange={e => setEditingRule(x => x ? { ...x, keyword: e.target.value } : null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRule(editingRule.keyword, t.category_id ?? '')
                        if (e.key === 'Escape') setEditingRule(null)
                      }} />
                    <button onClick={() => saveRule(editingRule.keyword, t.category_id ?? '')} className="text-green-500 text-xs">✓</button>
                    <button onClick={() => setEditingRule(null)} className="text-gray-300 text-xs">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => t.category_id && setEditingRule({ id: t.id, keyword: suggestKeyword(t.description) })}
                    disabled={!t.category_id}
                    className={`shrink-0 text-sm transition-colors ${savedRuleKws.has(suggestKeyword(t.description)) ? 'text-blue-400' : 'text-gray-200 hover:text-blue-300'} disabled:opacity-20`}
                    title="Save as rule">🔖</button>
                )
              )}

              {/* Amount */}
              <span className={`text-sm font-semibold shrink-0 w-20 text-right ${
                t.type === 'income' ? 'text-green-600' : t.type === 'transfer' ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {t.type === 'income' ? '+' : t.type === 'transfer' ? '↔' : '-'}{fmtExact(Number(t.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer section (collapsed) */}
      {transfers.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <summary className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-50">
            Transfers / Payments ({transfers.length})
          </summary>
          <div className="divide-y divide-gray-50">
            {transfers.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base shrink-0">↔</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.date}</p>
                </div>
                <span className="text-sm text-gray-400">{fmtExact(Number(t.amount))}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
