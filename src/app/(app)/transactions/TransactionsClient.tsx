'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Transaction } from '@/lib/types'
import AddTransactionModal from './AddTransactionModal'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function TransactionsClient({
  transactions: initial, accounts, categories
}: {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
}) {
  const [filter, setFilter] = useState({ account: '', tax_type: '', search: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [transactions, setTransactions] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedRules, setSavedRules] = useState<Set<string>>(new Set())
  const [editingRule, setEditingRule] = useState<{ txId: string; keyword: string } | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('budget_import_rules').select('keyword').then(({ data }) => {
      if (data) setSavedRules(new Set(data.map((r: any) => r.keyword)))
    })
  }, [])

  async function saveAsRule(keyword: string, category_id: string) {
    if (!category_id || !keyword.trim()) return
    const kw = keyword.toLowerCase().trim()
    const sb = createClient()
    await sb.from('budget_import_rules').upsert({ keyword: kw, category_id }, { onConflict: 'keyword' })
    setSavedRules(s => new Set(s).add(kw))
    setEditingRule(null)
  }

  const filtered = transactions.filter(t => {
    if (filter.account && t.account_id !== filter.account) return false
    if (filter.tax_type && t.tax_type !== filter.tax_type) return false
    if (filter.search && !t.description.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  async function updateCategory(id: string, category_id: string) {
    const cat = categories.find(c => c.id === category_id)
    const sb = createClient()
    await sb.from('budget_transactions').update({
      category_id: category_id || null,
      tax_type: cat?.tax_type ?? 'none',
      irs_category: cat?.irs_category ?? null,
    }).eq('id', id)
    setTransactions(ts => ts.map(t => t.id === id
      ? { ...t, category_id, tax_type: cat?.tax_type ?? 'none', category: cat } as any
      : t
    ))
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add</button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[140px]"
          placeholder="Search…"
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
        />
        <select className="input w-auto" value={filter.account}
          onChange={e => setFilter(f => ({ ...f, account: e.target.value }))}>
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input w-auto" value={filter.tax_type}
          onChange={e => setFilter(f => ({ ...f, tax_type: e.target.value }))}>
          <option value="">All types</option>
          <option value="personal">Personal</option>
          <option value="business">Business</option>
          <option value="none">Untagged</option>
        </select>
      </div>

      {/* List */}
      <div className="card divide-y divide-gray-50">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No transactions found</p>
        )}
        {filtered.map(t => (
          <div key={t.id} className="flex items-center justify-between py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xl shrink-0">{(t as any).category?.icon ?? '📌'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-xs text-gray-400">
                  {t.date} · {(t as any).account?.name}
                </p>
                {/* Inline category editor */}
                {editingId === t.id ? (
                  <select
                    autoFocus
                    className="input text-xs py-0.5 mt-1 w-full max-w-[260px]"
                    value={t.category_id ?? ''}
                    onChange={e => updateCategory(t.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingId(t.id)}
                    className="text-xs text-gray-400 hover:text-brand-600 transition-colors mt-0.5 text-left"
                  >
                    {(t as any).category?.name ?? 'Uncategorized'} ✏️
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {t.tax_type !== 'none' && (
                <span className={t.tax_type === 'business' ? 'badge-business' : 'badge-personal'}>
                  {t.irs_category ?? t.tax_type}
                </span>
              )}
              {editingRule?.txId === t.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="input text-xs py-0.5 w-28"
                    value={editingRule.keyword}
                    onChange={e => setEditingRule(r => r ? { ...r, keyword: e.target.value } : null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveAsRule(editingRule.keyword, t.category_id)
                      if (e.key === 'Escape') setEditingRule(null)
                    }}
                  />
                  <button onClick={() => saveAsRule(editingRule.keyword, t.category_id)} className="text-green-500 text-sm">✓</button>
                  <button onClick={() => setEditingRule(null)} className="text-gray-300 text-sm">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => t.category_id && setEditingRule({ txId: t.id, keyword: t.description.toLowerCase().trim() })}
                  disabled={!t.category_id}
                  title="규칙으로 저장"
                  className={`text-base transition-colors ${
                    savedRules.has(t.description.toLowerCase().trim())
                      ? 'text-brand-500'
                      : 'text-gray-300 hover:text-brand-400'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  🔖
                </button>
              )}
              <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); window.location.reload() }}
        />
      )}
    </div>
  )
}
