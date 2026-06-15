'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, AccountType, Category, ImportRule } from '@/lib/types'
import { useRouter } from 'next/navigation'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'joint_account',  label: 'Joint Account' },
  { value: 'personal_card',  label: 'Personal Card' },
  { value: 'business_card',  label: 'Business Card' },
  { value: 'office_account', label: 'Office Account' },
]

const TYPE_ICONS: Record<AccountType, string> = {
  joint_account:  '🏦',
  personal_card:  '💳',
  business_card:  '🏢',
  office_account: '🗂️',
}

const EMPTY_FORM = {
  name: '',
  type: 'joint_account' as AccountType,
  balance: '',
  is_debt: false,
  credit_limit: '',
  interest_rate: '',
  minimum_payment: '',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function SettingsClient({
  accounts: initial,
  categories,
  rules: initialRules,
}: {
  accounts: Account[]
  categories: Category[]
  rules: ImportRule[]
}) {
  const router = useRouter()
  const supabase = createClient()

  // ── Accounts ──────────────────────────────────────────────
  const [accounts, setAccounts] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const isCard = form.type === 'personal_card' || form.type === 'business_card'

  async function handleAddAccount() {
    if (!form.name.trim()) return setError('Account name is required')
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user!.id,
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance || '0'),
      is_debt: form.is_debt,
      credit_limit:    (isCard || form.is_debt) && form.credit_limit    ? parseFloat(form.credit_limit)    : null,
      interest_rate:   form.is_debt && form.interest_rate               ? parseFloat(form.interest_rate)   : null,
      minimum_payment: form.is_debt && form.minimum_payment             ? parseFloat(form.minimum_payment) : null,
    }
    const { data, error: err } = await supabase.from('budget_accounts').insert(payload).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setAccounts(a => [...a, data])
    setForm(EMPTY_FORM); setShowForm(false); setSaving(false)
    router.refresh()
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm('Delete this account? All transactions linked to it will also be removed.')) return
    setDeletingId(id)
    await supabase.from('budget_accounts').delete().eq('id', id)
    setAccounts(a => a.filter(x => x.id !== id))
    setDeletingId(null); router.refresh()
  }

  // ── Import Rules ──────────────────────────────────────────
  const [rules, setRules] = useState(initialRules)
  const [ruleKeyword, setRuleKeyword] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')
  const [savingRule, setSavingRule] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  async function handleAddRule() {
    if (!ruleKeyword.trim() || !ruleCategoryId) return
    setSavingRule(true)
    const { data, error: err } = await supabase
      .from('budget_import_rules')
      .insert({ keyword: ruleKeyword.trim().toLowerCase(), category_id: ruleCategoryId })
      .select('*, category:budget_categories(*)')
      .single()
    if (!err && data) {
      setRules(r => [...r, data])
      setRuleKeyword(''); setRuleCategoryId('')
    }
    setSavingRule(false)
  }

  async function handleDeleteRule(id: string) {
    setDeletingRuleId(id)
    await supabase.from('budget_import_rules').delete().eq('id', id)
    setRules(r => r.filter(x => x.id !== id))
    setDeletingRuleId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* ── Accounts ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Accounts & Cards</h2>
          <button onClick={() => { setShowForm(true); setError('') }} className="btn-primary text-xs px-3 py-1.5">
            + Add account
          </button>
        </div>

        {accounts.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 text-center py-6">No accounts yet.</p>
        )}

        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">{TYPE_ICONS[a.type]}</span>
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-400">
                    {ACCOUNT_TYPES.find(t => t.value === a.type)?.label}
                    {a.is_debt && a.interest_rate ? ` · ${a.interest_rate}% APR` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-semibold ${a.is_debt ? 'text-red-500' : 'text-gray-800'}`}>
                    {fmt(Number(a.balance))}
                  </p>
                  {a.credit_limit && (
                    <p className="text-xs text-gray-400">limit {fmt(Number(a.credit_limit))}</p>
                  )}
                </div>
                <button onClick={() => handleDeleteAccount(a.id)} disabled={deletingId === a.id}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm px-1">
                  {deletingId === a.id ? '…' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add account form */}
      {showForm && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold">New Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Account name</label>
              <input className="input" placeholder="e.g. Chase Checking"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Current balance</label>
              <input className="input" type="number" placeholder="0.00"
                value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
            </div>
            {(isCard || form.is_debt) && (
              <div>
                <label className="label">Credit limit</label>
                <input className="input" type="number" placeholder="0.00"
                  value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input type="checkbox" checked={form.is_debt}
              onChange={e => setForm(f => ({ ...f, is_debt: e.target.checked }))} className="w-4 h-4 rounded" />
            <span className="text-sm">This is a debt account</span>
          </label>
          {form.is_debt && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Interest rate (%)</label>
                <input className="input" type="number" placeholder="e.g. 24.99"
                  value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
              <div>
                <label className="label">Minimum payment</label>
                <input className="input" type="number" placeholder="0.00"
                  value={form.minimum_payment} onChange={e => setForm(f => ({ ...f, minimum_payment: e.target.value }))} />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAddAccount} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save account'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError('') }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Import Rules ── */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Import Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">키워드가 거래 내역에 포함되면 자동으로 카테고리를 지정합니다.</p>
        </div>

        {/* Add rule form */}
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder='키워드 (예: square, louie properties, ashp)'
            value={ruleKeyword}
            onChange={e => setRuleKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRule()}
          />
          <select className="input w-48" value={ruleCategoryId}
            onChange={e => setRuleCategoryId(e.target.value)}>
            <option value="">카테고리 선택</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={handleAddRule} disabled={savingRule || !ruleKeyword.trim() || !ruleCategoryId}
            className="btn-primary px-4 shrink-0">
            {savingRule ? '…' : '+ Add'}
          </button>
        </div>

        {rules.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">규칙이 없습니다. 위에서 추가해 보세요.</p>
        )}

        <div className="space-y-1">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{r.keyword}</code>
                <span className="text-xs text-gray-400">→</span>
                <span className="text-xs font-medium">
                  {(r as any).category?.icon} {(r as any).category?.name}
                </span>
              </div>
              <button onClick={() => handleDeleteRule(r.id)} disabled={deletingRuleId === r.id}
                className="text-gray-300 hover:text-red-400 transition-colors text-sm px-1">
                {deletingRuleId === r.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
