'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category } from '@/lib/types'

export default function AddTransactionModal({ accounts, categories, onClose, onSaved }: {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    account_id: accounts[0]?.id ?? '',
    category_id: '',
    amount: '',
    type: 'expense' as 'expense' | 'income',
    description: '',
    date: new Date().toISOString().split('T')[0],
    tax_type: 'none' as 'personal' | 'business' | 'none',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const selectedCat = categories.find(c => c.id === form.category_id)

  async function save() {
    if (!form.account_id || !form.amount || !form.description) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const irs = selectedCat?.irs_category ?? null
    await supabase.from('budget_transactions').insert({
      account_id: form.account_id,
      category_id: form.category_id || null,
      amount: parseFloat(form.amount),
      type: form.type,
      description: form.description,
      date: form.date,
      entered_by: user!.id,
      tax_type: form.tax_type,
      irs_category: irs,
      notes: form.notes || null,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex gap-2">
          {(['expense','income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                form.type === t ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <input className="input" placeholder="e.g. Costco run" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount ($)</label>
            <input className="input" type="number" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input className="input" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Account</label>
            <select className="input" value={form.account_id}
              onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select className="input" value={form.category_id}
              onChange={e => {
                const cat = categories.find(c => c.id === e.target.value)
                setForm(f => ({ ...f, category_id: e.target.value, tax_type: cat?.tax_type as any ?? 'none' }))
              }}>
              <option value="">Select…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Tax type</label>
            <div className="flex gap-2">
              {(['none','personal','business'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tax_type: t }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.tax_type === t ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500'
                  }`}>
                  {t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {selectedCat?.irs_category && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">IRS: <span className="text-violet-600">{selectedCat.irs_category}</span></p>
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full py-3">
          {saving ? 'Saving…' : 'Save transaction'}
        </button>
      </div>
    </div>
  )
}
