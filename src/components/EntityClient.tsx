'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Transaction } from '@/lib/types'

type Entity = 'glow' | 'acuboost' | 'personal'
type Tab = 'overview' | 'transactions' | 'import'
type Person = 'all' | 'jiyeon' | 'junwoo'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function suggestKeyword(desc: string): string {
  const lower = desc.toLowerCase()
  const origMatch = lower.match(/orig co name:\s*([^o]+?)(?:\s+orig id:|\s+desc date:|$)/)
  if (origMatch) return origMatch[1].trim()
  const toMatch = lower.match(/\bto\s+(.+?)(?:\s+\d{2}\/\d{2})?$/)
  if (toMatch) return toMatch[1].trim()
  return lower.split(/\s+/).slice(0, 3).join(' ')
}

function getCol(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found] !== undefined && row[found] !== '') return row[found]
  }
  return ''
}

function cleanDescription(raw: string): string {
  const origMatch = raw.match(/ORIG CO NAME:([^O]+?)(?:\s+ORIG ID:|$)/i)
  if (origMatch) return origMatch[1].trim()
  const toMatch = raw.match(/\bTo\s+(.+?)(?:\s+\d{2}\/\d{2})?$/i)
  if (toMatch) return toMatch[1].trim()
  return raw.trim()
}

interface ParsedRow {
  date: string; description: string; amount: number
  type: 'expense' | 'income'; selected: boolean
  category_id: string; tax_type: 'personal' | 'business' | 'none'
}

const ENTITY_CONFIG = {
  glow:      { label: 'Glow',      icon: '🏥', color: 'text-sky-600',     bg: 'bg-sky-50' },
  acuboost:  { label: 'Acuboost',  icon: '💻', color: 'text-violet-600',  bg: 'bg-violet-50' },
  personal:  { label: 'Personal',  icon: '🏠', color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

const PERSON_TABS: { key: Person; label: string }[] = [
  { key: 'all',    label: '전체' },
  { key: 'jiyeon', label: '지연' },
  { key: 'junwoo', label: '준우' },
]

function AccountCard({ account }: { account: Account }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-400 truncate mb-1">{account.name}</p>
      <p className={`text-base font-bold ${account.is_debt ? 'text-red-500' : 'text-gray-800'}`}>
        {fmt(Number(account.balance))}
      </p>
      {account.credit_limit && (
        <p className="text-xs text-gray-400 mt-0.5">한도 {fmt(Number(account.credit_limit))}</p>
      )}
    </div>
  )
}

export default function EntityClient({
  entity, accounts: initialAccounts, transactions: initialTxs, categories, rules: initialRules,
}: {
  entity: Entity
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  rules: any[]
}) {
  const cfg = ENTITY_CONFIG[entity]
  const sb = createClient()

  const [tab, setTab] = useState<Tab>('overview')
  const [transactions, setTransactions] = useState(initialTxs)
  const [rules, setRules] = useState(initialRules)
  const [accounts] = useState(initialAccounts)

  // ── Person filter (Personal only) ────────────────────────
  const [person, setPerson] = useState<Person>('all')

  const displayedAccounts = entity === 'personal' && person !== 'all'
    ? accounts.filter(a => a.owner === person)
    : accounts

  const displayedTxIds = new Set(displayedAccounts.map(a => a.id))
  const displayedTransactions = entity === 'personal' && person !== 'all'
    ? transactions.filter(t => displayedTxIds.has(t.account_id))
    : transactions

  // ── Summary ───────────────────────────────────────────────
  const income  = displayedTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = displayedTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = income - expense

  // ── Account grouping for Overview ─────────────────────────
  const bankAccounts = displayedAccounts.filter(a => a.type === 'joint_account' || a.type === 'office_account')
  const cardAccounts = displayedAccounts.filter(a => a.type === 'personal_card' || a.type === 'business_card')

  // ── Transactions state ────────────────────────────────────
  const [txFilter, setTxFilter] = useState({ account: '', tax_type: '', search: '' })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<{ id: string; keyword: string } | null>(null)
  const [savedRules, setSavedRules] = useState<Set<string>>(new Set(initialRules.map((r: any) => r.keyword)))

  const filteredTxs = displayedTransactions.filter(t => {
    if (txFilter.account && t.account_id !== txFilter.account) return false
    if (txFilter.tax_type && t.tax_type !== txFilter.tax_type) return false
    if (txFilter.search && !t.description.toLowerCase().includes(txFilter.search.toLowerCase())) return false
    return true
  })

  async function updateCategory(id: string, category_id: string) {
    const cat = categories.find(c => c.id === category_id)
    await sb.from('budget_transactions').update({
      category_id: category_id || null,
      tax_type: cat?.tax_type ?? 'none',
      irs_category: cat?.irs_category ?? null,
    }).eq('id', id)
    setTransactions(ts => ts.map(t => t.id === id
      ? { ...t, category_id, tax_type: cat?.tax_type ?? 'none', category: cat } as any : t))
    setEditingCatId(null)
  }

  async function saveRule(keyword: string, category_id: string) {
    if (!keyword.trim() || !category_id) return
    const kw = keyword.toLowerCase().trim()
    await sb.from('budget_import_rules').upsert({ keyword: kw, entity, category_id }, { onConflict: 'keyword,entity' })
    setSavedRules(s => new Set(s).add(kw))
    setRules(r => [...r.filter((x: any) => x.keyword !== kw), { keyword: kw, entity, category_id }])
    setEditingRule(null)
  }

  // ── Import state ──────────────────────────────────────────
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(0)
  const [importEditingRule, setImportEditingRule] = useState<{ rowIndex: number; keyword: string } | null>(null)
  const [importSavedRules, setImportSavedRules] = useState<Set<string>>(new Set(initialRules.map((r: any) => r.keyword)))
  const fileRef = useRef<HTMLInputElement>(null)

  function applyRules(desc: string) {
    const d = desc.toLowerCase()
    for (const rule of rules) {
      if (d.includes(rule.keyword.toLowerCase())) {
        const cat = categories.find(c => c.id === rule.category_id)
        return { category_id: rule.category_id, tax_type: (cat?.tax_type ?? 'none') as 'personal' | 'business' | 'none' }
      }
    }
    return { category_id: '', tax_type: 'none' as const }
  }

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed: ParsedRow[] = (data as any[]).map(row => {
          const rawDesc = getCol(row, 'description', 'merchant', 'name', 'memo') || String(Object.values(row)[1] ?? '')
          const desc = cleanDescription(rawDesc)
          const rawAmt = getCol(row, 'amount', 'debit', 'credit', 'transaction amount')
          const numAmt = parseFloat(String(rawAmt).replace(/[,$]/g, ''))
          const amount = Math.abs(numAmt)
          const type: 'expense' | 'income' = numAmt > 0 ? 'income' : 'expense'
          const rawDate = getCol(row, 'date', 'transaction date', 'posted date', 'posting date', 'trans date')
          const parsedDate = rawDate ? new Date(rawDate) : null
          const date = parsedDate && !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
          const { category_id, tax_type } = applyRules(desc)
          return { date, description: desc, amount, type, selected: true, category_id, tax_type }
        }).filter(r => r.amount > 0)
        setRows(parsed)
      },
    })
  }

  async function importSelected() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length || !accountId) return
    setSaving(true)
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('budget_transactions').insert(
      selected.map(r => ({
        account_id: accountId,
        category_id: r.category_id || null,
        amount: r.amount, type: r.type, description: r.description, date: r.date,
        entered_by: user!.id, tax_type: r.tax_type,
        irs_category: categories.find(c => c.id === r.category_id)?.irs_category ?? null,
      }))
    )
    if (!error) {
      setSaved(selected.length)
      setRows([])
      const { data: fresh } = await sb.from('budget_transactions')
        .select('*, category:budget_categories(*), account:budget_accounts(*)')
        .in('account_id', accounts.map(a => a.id))
        .order('date', { ascending: false })
      if (fresh) setTransactions(fresh as any)
    }
    setSaving(false)
  }

  async function saveImportRule(keyword: string, category_id: string) {
    if (!category_id || !keyword.trim()) return
    const kw = keyword.toLowerCase().trim()
    await sb.from('budget_import_rules').upsert({ keyword: kw, entity, category_id }, { onConflict: 'keyword,entity' })
    setImportSavedRules(s => new Set(s).add(kw))
    setRules(r => [...r.filter((x: any) => x.keyword !== kw), { keyword: kw, entity, category_id }])
    setImportEditingRule(null)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'import',       label: 'Import CSV' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{cfg.icon}</span>
        <h1 className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</h1>
      </div>

      {/* Person toggle — Personal only */}
      {entity === 'personal' && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {PERSON_TABS.map(p => (
            <button key={p.key} onClick={() => setPerson(p.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                person === p.key
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Income',   value: income,  cls: 'text-green-600' },
          { label: 'Expenses', value: expense, cls: 'text-red-500' },
          { label: 'Net',      value: net,     cls: net >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map(c => (
          <div key={c.label} className="card">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.cls}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? `border-brand-500 ${cfg.color}`
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Bank Accounts */}
          {bankAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bank Accounts</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {bankAccounts.map(a => <AccountCard key={a.id} account={a} />)}
              </div>
            </div>
          )}

          {/* Credit Cards */}
          {cardAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Credit Cards</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cardAccounts.map(a => <AccountCard key={a.id} account={a} />)}
              </div>
            </div>
          )}

          {displayedAccounts.length === 0 && (
            <div className="card text-center py-8 text-sm text-gray-400">
              계좌가 없습니다. Settings에서 추가해 주세요.
            </div>
          )}

          {/* Recent transactions */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Recent transactions</h2>
            {displayedTransactions.slice(0, 10).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No transactions yet</p>
            )}
            <div className="divide-y divide-gray-50">
              {displayedTransactions.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{(t as any).category?.icon ?? '📌'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <p className="text-xs text-gray-400">{t.date} · {(t as any).category?.name ?? 'Uncategorized'}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ml-2 ${t.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </p>
                </div>
              ))}
            </div>
            {displayedTransactions.length > 10 && (
              <button onClick={() => setTab('transactions')} className="text-xs text-brand-600 mt-3">
                See all {displayedTransactions.length} transactions →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Transactions tab ── */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          <div className="card flex flex-wrap gap-2">
            <input className="input flex-1 min-w-[140px]" placeholder="Search…"
              value={txFilter.search} onChange={e => setTxFilter(f => ({ ...f, search: e.target.value }))} />
            <select className="input w-auto" value={txFilter.account}
              onChange={e => setTxFilter(f => ({ ...f, account: e.target.value }))}>
              <option value="">All accounts</option>
              {displayedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="input w-auto" value={txFilter.tax_type}
              onChange={e => setTxFilter(f => ({ ...f, tax_type: e.target.value }))}>
              <option value="">All types</option>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
              <option value="none">Untagged</option>
            </select>
          </div>
          <div className="card divide-y divide-gray-50">
            {filteredTxs.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No transactions found</p>
            )}
            {filteredTxs.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <span className="text-xl shrink-0">{(t as any).category?.icon ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.date} · {(t as any).account?.name}</p>
                  {editingCatId === t.id ? (
                    <select autoFocus className="input text-xs py-0.5 mt-1 w-full max-w-[280px]"
                      value={t.category_id ?? ''}
                      onChange={e => updateCategory(t.id, e.target.value)}
                      onBlur={() => setEditingCatId(null)}>
                      <option value="">Uncategorized</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditingCatId(t.id)}
                      className="text-xs text-gray-400 hover:text-brand-600 transition-colors mt-0.5">
                      {(t as any).category?.name ?? 'Uncategorized'} ✏️
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {editingRule?.id === t.id ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus className="input text-xs py-0.5 w-28"
                        value={editingRule.keyword}
                        onChange={e => setEditingRule(r => r ? { ...r, keyword: e.target.value } : null)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRule(editingRule.keyword, t.category_id)
                          if (e.key === 'Escape') setEditingRule(null)
                        }} />
                      <button onClick={() => saveRule(editingRule.keyword, t.category_id)} className="text-green-500 text-sm">✓</button>
                      <button onClick={() => setEditingRule(null)} className="text-gray-300 text-sm">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => t.category_id && setEditingRule({ id: t.id, keyword: suggestKeyword(t.description) })}
                      disabled={!t.category_id} title="규칙으로 저장"
                      className={`text-base transition-colors ${
                        savedRules.has(suggestKeyword(t.description))
                          ? 'text-brand-500' : 'text-gray-300 hover:text-brand-400'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}>
                      🔖
                    </button>
                  )}
                  <p className={`text-sm font-semibold w-20 text-right ${t.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Import tab ── */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Account</label>
              <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}>
              <p className="text-3xl mb-2">⬆️</p>
              <p className="text-sm font-medium text-gray-600">Drop CSV here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Chase, BofA, Amex, Citi 등 대부분 은행 CSV 지원</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          </div>

          {saved > 0 && (
            <div className="card bg-green-50 border-green-100">
              <p className="text-sm text-green-700 font-medium">✅ {saved}개 거래가 저장됐습니다!</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{rows.filter(r => r.selected).length} / {rows.length} 선택됨</p>
                <div className="flex gap-2">
                  <button onClick={() => setRows(rs => rs.map(r => ({ ...r, selected: true })))}
                    className="btn-secondary text-xs px-3 py-1.5">전체 선택</button>
                  <button onClick={importSelected} disabled={saving} className="btn-primary">
                    {saving ? 'Importing…' : `Import ${rows.filter(r => r.selected).length}개`}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <input type="checkbox" checked={r.selected}
                      onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                      className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-gray-400">{r.date}</p>
                    </div>
                    <select className="input w-44 text-xs py-1" value={r.category_id}
                      onChange={e => {
                        const cat = categories.find(c => c.id === e.target.value)
                        setRows(rs => rs.map((x, j) => j === i ? { ...x, category_id: e.target.value, tax_type: cat?.tax_type ?? 'none' } : x))
                      }}>
                      <option value="">Uncategorized</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                    {importEditingRule?.rowIndex === i ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input autoFocus className="input text-xs py-0.5 w-28"
                          value={importEditingRule.keyword}
                          onChange={e => setImportEditingRule(r => r ? { ...r, keyword: e.target.value } : null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveImportRule(importEditingRule.keyword, r.category_id)
                            if (e.key === 'Escape') setImportEditingRule(null)
                          }} />
                        <button onClick={() => saveImportRule(importEditingRule.keyword, r.category_id)} className="text-green-500 text-sm">✓</button>
                        <button onClick={() => setImportEditingRule(null)} className="text-gray-300 text-sm">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => r.category_id && setImportEditingRule({ rowIndex: i, keyword: suggestKeyword(r.description) })}
                        disabled={!r.category_id} title="규칙으로 저장"
                        className={`shrink-0 text-base transition-colors ${
                          importSavedRules.has(suggestKeyword(r.description))
                            ? 'text-brand-500' : 'text-gray-300 hover:text-brand-400'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}>
                        🔖
                      </button>
                    )}
                    <span className={`text-xs font-medium shrink-0 w-20 text-right ${r.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
                      {r.type === 'income' ? '+' : '-'}${r.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
