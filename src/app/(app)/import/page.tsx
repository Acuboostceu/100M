'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'

interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  selected: boolean
  category_id: string
  tax_type: 'personal' | 'business' | 'none'
}

const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; tax_type: 'personal'|'business'|'none'; irs_category?: string }> = {
  'Groceries':        { keywords: ['costco','trader joe','whole foods','safeway','kroger','walmart','grocery','market'], tax_type: 'personal' },
  'Dining out':       { keywords: ['restaurant','mcdonald','starbucks','chipotle','pizza','doordash','ubereats','grubhub','cafe','diner'], tax_type: 'personal' },
  'Gas':              { keywords: ['chevron','shell','arco','exxon','gas station','76','mobil','bp'], tax_type: 'personal' },
  'Travel':           { keywords: ['airline','united','delta','southwest','hotel','marriott','hilton','airbnb','expedia','booking.com'], tax_type: 'business' },
  'Office supplies':  { keywords: ['amazon','staples','office depot','best buy','apple.com'], tax_type: 'business' },
  'Software/SaaS':    { keywords: ['google','microsoft','adobe','dropbox','zoom','slack','notion','figma','github','vercel'], tax_type: 'business' },
  'Medical':          { keywords: ['pharmacy','cvs','walgreens','hospital','clinic','dental','doctor'], tax_type: 'personal' },
  'Utilities':        { keywords: ['electric','water','internet','comcast','att','verizon','t-mobile','pg&e','edison'], tax_type: 'personal' },
}

function autoCategory(desc: string) {
  const d = desc.toLowerCase()
  for (const [cat, { keywords, tax_type }] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => d.includes(k))) return { category: cat, tax_type }
  }
  return { category: 'Other', tax_type: 'none' as const }
}

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadAccounts() {
    const sb = createClient()
    const [{ data: accs }, { data: cats }] = await Promise.all([
      sb.from('budget_accounts').select('*').order('type'),
      sb.from('budget_categories').select('*').order('name'),
    ])
    setAccounts(accs ?? [])
    setCategories(cats ?? [])
    if (accs?.length) setAccountId(accs[0].id)
  }

  useState(() => { loadAccounts() })

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed: ParsedRow[] = (data as any[]).map(row => {
          const desc = row['Description'] ?? row['Merchant'] ?? row['Name'] ?? Object.values(row)[1] ?? ''
          const rawAmt = row['Amount'] ?? row['Debit'] ?? row['Credit'] ?? '0'
          const amount = Math.abs(parseFloat(String(rawAmt).replace(/[,$]/g, '')))
          const isIncome = parseFloat(String(rawAmt).replace(/[,$]/g, '')) > 0 && (row['Credit'] !== undefined ? true : false)
          const date = row['Date'] ?? row['Transaction Date'] ?? row['Posted Date'] ?? ''
          const { category, tax_type } = autoCategory(desc)
          const catObj = categories.find(c => c.name === category)
          return {
            date: date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            description: desc,
            amount,
            type: (isIncome ? 'income' : 'expense') as 'income' | 'expense',
            selected: true,
            category_id: catObj?.id ?? '',
            tax_type,
          }
        }).filter(r => r.amount > 0)
        setRows(parsed)
      },
    })
  }

  async function importSelected() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length || !accountId) return
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('budget_transactions').insert(
      selected.map(r => ({
        account_id: accountId,
        category_id: r.category_id || null,
        amount: r.amount,
        type: r.type,
        description: r.description,
        date: r.date,
        entered_by: user!.id,
        tax_type: r.tax_type,
        irs_category: categories.find(c => c.id === r.category_id)?.irs_category ?? null,
      }))
    )
    if (!error) {
      setSaved(selected.length)
      setRows([])
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Import statement</h1>

      <div className="card space-y-3">
        <p className="text-sm text-gray-500">Upload a CSV bank/card statement. We'll auto-categorize and you review before saving.</p>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Account</label>
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
        >
          <p className="text-3xl mb-2">⬆️</p>
          <p className="text-sm font-medium text-gray-600">Drop CSV here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Works with Chase, BofA, Amex, Citi, and most bank exports</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      </div>

      {saved > 0 && (
        <div className="card bg-green-50 border-green-100">
          <p className="text-sm text-green-700 font-medium">✅ {saved} transactions imported successfully!</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{rows.filter(r => r.selected).length} of {rows.length} selected</p>
            <button onClick={importSelected} disabled={saving} className="btn-primary">
              {saving ? 'Importing…' : `Import ${rows.filter(r => r.selected).length}`}
            </button>
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
                <select
                  className="input w-36 text-xs py-1"
                  value={r.category_id}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value)
                    setRows(rs => rs.map((x, j) => j === i ? { ...x, category_id: e.target.value, tax_type: cat?.tax_type ?? 'none' } : x))
                  }}
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <span className={`text-xs font-medium shrink-0 ${r.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
                  {r.type === 'income' ? '+' : '-'}${r.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
