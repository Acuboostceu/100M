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

function cleanDescription(raw: string): string {
  // Extract merchant name from ACH format: "ORIG CO NAME:Square Inc ORIG ID:..."
  const origMatch = raw.match(/ORIG CO NAME:([^O]+?)(?:\s+ORIG ID:|$)/i)
  if (origMatch) return origMatch[1].trim()
  // "Online Payment 1234 To Merchant Name 05/22" → "Merchant Name"
  const toMatch = raw.match(/\bTo\s+(.+?)(?:\s+\d{2}\/\d{2})?$/i)
  if (toMatch) return toMatch[1].trim()
  return raw.trim()
}

function getCol(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found] !== undefined && row[found] !== '') return row[found]
  }
  return ''
}

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(0)
  const [savedRules, setSavedRules] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    const sb = createClient()
    const [{ data: accs }, { data: cats }, { data: rls }] = await Promise.all([
      sb.from('budget_accounts').select('*').order('type'),
      sb.from('budget_categories').select('*').order('name'),
      sb.from('budget_import_rules').select('*, category:budget_categories(*)'),
    ])
    setAccounts(accs ?? [])
    setCategories(cats ?? [])
    setRules(rls ?? [])
    if (accs?.length) setAccountId(accs[0].id)
  }

  useState(() => { loadData() })

  async function saveAsRule(desc: string, category_id: string) {
    if (!category_id) return
    const keyword = desc.toLowerCase().trim()
    const sb = createClient()
    const { error } = await sb.from('budget_import_rules')
      .upsert({ keyword, category_id }, { onConflict: 'keyword' })
    if (!error) {
      setSavedRules(s => new Set(s).add(keyword))
      setRules(r => [...r.filter(x => x.keyword !== keyword), { keyword, category_id }])
    }
  }

  function applyRules(desc: string, cats: any[], rls: any[]) {
    const d = desc.toLowerCase()
    for (const rule of rls) {
      if (d.includes(rule.keyword.toLowerCase())) {
        return {
          category_id: rule.category_id,
          tax_type: (rule.category?.tax_type ?? 'none') as 'personal' | 'business' | 'none',
        }
      }
    }
    return { category_id: '', tax_type: 'none' as const }
  }

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed: ParsedRow[] = (data as any[]).map(row => {
          const rawDesc = getCol(row, 'description', 'merchant', 'name', 'memo') || String(Object.values(row)[1] ?? '')
          const desc = cleanDescription(rawDesc)

          const rawAmt = getCol(row, 'amount', 'debit', 'credit', 'transaction amount')
          const numAmt = parseFloat(String(rawAmt).replace(/[,$]/g, ''))
          const amount = Math.abs(numAmt)

          // Negative amount = expense, positive = income (Chase/BofA convention)
          const isIncome = numAmt > 0
          const type: 'expense' | 'income' = isIncome ? 'income' : 'expense'

          const rawDate = getCol(row, 'date', 'transaction date', 'posted date', 'posting date', 'trans date')
          const parsedDate = rawDate ? new Date(rawDate) : null
          const date = parsedDate && !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]

          const { category_id, tax_type } = applyRules(desc, categories, rules)

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
    if (!error) { setSaved(selected.length); setRows([]) }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Import statement</h1>

      <div className="card space-y-3">
        <p className="text-sm text-gray-500">
          CSV 스테이트먼트를 업로드하세요. Settings에서 설정한 규칙이 자동 적용됩니다.
        </p>
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
                <select
                  className="input w-40 text-xs py-1"
                  value={r.category_id}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value)
                    setRows(rs => rs.map((x, j) => j === i ? { ...x, category_id: e.target.value, tax_type: cat?.tax_type ?? 'none' } : x))
                  }}
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <button
                  onClick={() => saveAsRule(r.description, r.category_id)}
                  disabled={!r.category_id}
                  title="규칙으로 저장"
                  className={`shrink-0 text-base transition-colors ${
                    savedRules.has(r.description.toLowerCase().trim())
                      ? 'text-brand-500'
                      : 'text-gray-300 hover:text-brand-400'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  🔖
                </button>
                <span className={`text-xs font-medium shrink-0 w-20 text-right ${r.type === 'income' ? 'text-green-600' : 'text-gray-700'}`}>
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
