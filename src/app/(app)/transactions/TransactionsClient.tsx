'use client'
import { useState } from 'react'
import { Account, Category, Transaction } from '@/lib/types'
import AddTransactionModal from './AddTransactionModal'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function TransactionsClient({
  transactions, accounts, categories
}: {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
}) {
  const [filter, setFilter] = useState({ account: '', tax_type: '', search: '' })
  const [showAdd, setShowAdd] = useState(false)

  const filtered = transactions.filter(t => {
    if (filter.account && t.account_id !== filter.account) return false
    if (filter.tax_type && t.tax_type !== filter.tax_type) return false
    if (filter.search && !t.description.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

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
        <select
          className="input w-auto"
          value={filter.account}
          onChange={e => setFilter(f => ({ ...f, account: e.target.value }))}
        >
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          className="input w-auto"
          value={filter.tax_type}
          onChange={e => setFilter(f => ({ ...f, tax_type: e.target.value }))}
        >
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
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0">{(t as any).category?.icon ?? '📌'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-xs text-gray-400">
                  {t.date} · {(t as any).account?.name} · {(t as any).category?.name ?? 'Uncategorized'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {t.tax_type !== 'none' && (
                <span className={t.tax_type === 'business' ? 'badge-business' : 'badge-personal'}>
                  {t.irs_category ?? t.tax_type}
                </span>
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
