'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Entity, Institution, Owner, ImportRule } from '@/lib/types'
import { filterCategories } from '@/lib/entityUtils'
import { useRouter } from 'next/navigation'

const ACCOUNT_TYPES: { value: 'checking' | 'credit_card'; label: string; icon: string }[] = [
  { value: 'checking',    label: 'Checking / Savings', icon: '🏦' },
  { value: 'credit_card', label: 'Credit Card',        icon: '💳' },
]

const INSTITUTIONS: { value: Institution; label: string }[] = [
  { value: 'boa',          label: 'Bank of America' },
  { value: 'chase',        label: 'Chase' },
  { value: 'citi',         label: 'Citi' },
  { value: 'amex',         label: 'American Express' },
  { value: 'capital_one',  label: 'Capital One' },
  { value: 'other',        label: 'Other' },
]

const ENTITIES: { value: Entity; label: string; color: string }[] = [
  { value: 'glow',     label: 'Glow',     color: 'bg-sky-100 text-sky-700' },
  { value: 'acuboost', label: 'Acuboost', color: 'bg-violet-100 text-violet-700' },
  { value: 'personal', label: 'Personal', color: 'bg-emerald-100 text-emerald-700' },
]

const OWNERS: { value: Owner | ''; label: string }[] = [
  { value: '',         label: 'Joint / Unassigned' },
  { value: 'jiyeon',  label: 'Jiyeon' },
  { value: 'husband', label: 'Husband' },
]

type AccountFormType = 'checking' | 'credit_card'

const EMPTY_FORM = {
  name: '',
  type: 'checking' as AccountFormType,
  entity: 'personal' as Entity,
  owner: '' as Owner | '',
  institution: 'chase' as Institution,
  credit_limit: '',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function SettingsClient({
  accounts: initial,
  categories: initialCategories,
  rules: initialRules,
}: {
  accounts: Account[]
  categories: Category[]
  rules: ImportRule[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>(initialCategories)
  useEffect(() => {
    supabase.from('budget_categories').select('*').order('name').then(({ data }) => {
      if (data?.length) setCategories(data)
    })
  }, [])

  // ── Accounts ──────────────────────────────────────────────
  const [accounts, setAccounts] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(a: Account) {
    setEditingId(a.id)
    setEditForm({
      name: a.name,
      type: a.type as AccountFormType,
      entity: a.entity,
      owner: (a.owner ?? '') as Owner | '',
      institution: a.institution,
      credit_limit: (a.credit_limit ? String(a.credit_limit) : ''),
    })
  }

  async function handleAdd() {
    if (!form.name.trim()) return setError('Account name is required')
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase.from('budget_accounts').insert({
      user_id: user!.id,
      name: form.name.trim(),
      type: form.type,
      entity: form.entity,
      owner: form.owner || null,
      institution: form.institution,
      credit_limit: form.type === 'credit_card' && form.credit_limit ? parseFloat(form.credit_limit) : null,
      balance: 0,
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setAccounts(a => [...a, data])
    setForm(EMPTY_FORM); setShowForm(false); setSaving(false)
    router.refresh()
  }

  async function handleUpdate() {
    if (!editingId || !editForm.name.trim()) return
    setEditSaving(true)
    const { data, error: err } = await supabase.from('budget_accounts').update({
      name: editForm.name.trim(),
      type: editForm.type,
      entity: editForm.entity,
      owner: editForm.owner || null,
      institution: editForm.institution,
      credit_limit: editForm.type === 'credit_card' && editForm.credit_limit ? parseFloat(editForm.credit_limit) : null,
    }).eq('id', editingId).select().single()
    if (!err && data) {
      setAccounts(a => a.map(x => x.id === editingId ? data : x))
      setEditingId(null)
      router.refresh()
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account? All linked statements and transactions will also be removed.')) return
    setDeletingId(id)
    await supabase.from('budget_accounts').delete().eq('id', id)
    setAccounts(a => a.filter(x => x.id !== id))
    setDeletingId(null); router.refresh()
  }

  // ── Import Rules ──────────────────────────────────────────
  const [rules, setRules] = useState(initialRules)
  const [ruleKeyword, setRuleKeyword] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')
  const [ruleEntity, setRuleEntity] = useState<Entity>('glow')
  const [savingRule, setSavingRule] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  async function handleAddRule() {
    if (!ruleKeyword.trim() || !ruleCategoryId) return
    setSavingRule(true)
    const { data, error: err } = await supabase
      .from('budget_import_rules')
      .upsert({ keyword: ruleKeyword.trim().toLowerCase(), entity: ruleEntity, category_id: ruleCategoryId }, { onConflict: 'keyword,entity' })
      .select('*, category:budget_categories(*)')
      .single()
    if (!err && data) {
      setRules(r => [...r.filter(x => !(x.keyword === data.keyword && x.entity === data.entity)), data as any])
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

  // Group accounts by entity
  const grouped = ENTITIES.map(e => ({
    ...e,
    accs: accounts.filter(a => a.entity === e.value),
  }))

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

        <div className="space-y-4">
          {grouped.map(g => (
            <div key={g.value}>
              {g.accs.length > 0 && (
                <>
                  <p className={`text-xs font-semibold mb-2 px-1 ${g.color.split(' ')[1]}`}>{g.label}</p>
                  {g.accs.map(a => (
                    <div key={a.id} className="border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{a.type === 'credit_card' ? '💳' : '🏦'}</span>
                          <div>
                            <p className="text-sm font-medium">{a.name}</p>
                            <p className="text-xs text-gray-400">
                              {INSTITUTIONS.find(i => i.value === a.institution)?.label ?? a.institution}
                              {a.type === 'credit_card' && a.credit_limit ? ` · limit ${fmt(Number(a.credit_limit))}` : ''}
                              {a.owner ? ` · ${a.owner === 'jiyeon' ? 'Jiyeon' : 'Husband'}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => editingId === a.id ? setEditingId(null) : startEdit(a)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${editingId === a.id ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}>
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(a.id)} disabled={deletingId === a.id}
                            className="text-gray-300 hover:text-red-400 transition-colors text-sm px-1">
                            {deletingId === a.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>

                      {/* Inline edit */}
                      {editingId === a.id && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-2 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="label">Account name</label>
                              <input className="input" value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">Institution</label>
                              <select className="input" value={editForm.institution}
                                onChange={e => setEditForm(f => ({ ...f, institution: e.target.value as Institution }))}>
                                {INSTITUTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">Type</label>
                              <select className="input" value={editForm.type}
                                onChange={e => setEditForm(f => ({ ...f, type: e.target.value as AccountFormType }))}>
                                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">Entity</label>
                              <select className="input" value={editForm.entity}
                                onChange={e => setEditForm(f => ({ ...f, entity: e.target.value as Entity }))}>
                                {ENTITIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                              </select>
                            </div>
                            {editForm.entity === 'personal' && (
                              <div>
                                <label className="label">Owner</label>
                                <select className="input" value={editForm.owner}
                                  onChange={e => setEditForm(f => ({ ...f, owner: e.target.value as Owner | '' }))}>
                                  {OWNERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>
                            )}
                            {editForm.type === 'credit_card' && (
                              <div>
                                <label className="label">Credit limit</label>
                                <input className="input" type="number" placeholder="0.00"
                                  value={editForm.credit_limit}
                                  onChange={e => setEditForm(f => ({ ...f, credit_limit: e.target.value }))} />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleUpdate} disabled={editSaving} className="btn-primary text-sm">
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
          {accounts.length === 0 && !showForm && (
            <p className="text-sm text-gray-400 text-center py-6">No accounts yet. Add one above.</p>
          )}
        </div>
      </div>

      {/* Add account form */}
      {showForm && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold">New Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Account name</label>
              <input className="input" placeholder="e.g. Chase Business Checking"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Institution</label>
              <select className="input" value={form.institution}
                onChange={e => setForm(f => ({ ...f, institution: e.target.value as Institution }))}>
                {INSTITUTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountFormType }))}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Entity</label>
              <select className="input" value={form.entity}
                onChange={e => setForm(f => ({ ...f, entity: e.target.value as Entity, owner: '' }))}>
                {ENTITIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            {form.entity === 'personal' && (
              <div>
                <label className="label">Owner</label>
                <select className="input" value={form.owner}
                  onChange={e => setForm(f => ({ ...f, owner: e.target.value as Owner | '' }))}>
                  {OWNERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {form.type === 'credit_card' && (
              <div>
                <label className="label">Credit limit</label>
                <input className="input" type="number" placeholder="0.00"
                  value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} />
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={saving} className="btn-primary">
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
          <h2 className="text-sm font-semibold">Auto-Categorization Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">Keyword found in transaction description → auto-assign category on import.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <select className="input w-32 shrink-0" value={ruleEntity}
            onChange={e => { setRuleEntity(e.target.value as Entity); setRuleCategoryId('') }}>
            {ENTITIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <input
            className="input flex-1 min-w-[140px]"
            placeholder='keyword (e.g. square, costco)'
            value={ruleKeyword}
            onChange={e => setRuleKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRule()}
          />
          <select className="input w-48" value={ruleCategoryId}
            onChange={e => setRuleCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {filterCategories(categories, ruleEntity).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={handleAddRule} disabled={savingRule || !ruleKeyword.trim() || !ruleCategoryId}
            className="btn-primary px-4 shrink-0">
            {savingRule ? '…' : '+ Add'}
          </button>
        </div>

        {rules.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No rules yet. Rules save automatically when you tag a transaction on import.</p>
        )}

        {ENTITIES.map(ent => {
          const entRules = rules.filter(r => r.entity === ent.value)
          if (entRules.length === 0) return null
          return (
            <div key={ent.value} className="mb-4">
              <p className={`text-xs font-semibold mb-1.5 px-1 ${ent.color.split(' ')[1]}`}>{ent.label}</p>
              <div className="space-y-0.5">
                {entRules.map(r => (
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
          )
        })}
      </div>
    </div>
  )
}
