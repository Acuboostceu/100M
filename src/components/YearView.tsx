'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Statement, Entity, ImportRule } from '@/lib/types'
import { parseCSV, applyRules, suggestKeyword, ParsedRow } from '@/lib/parsers'
import Link from 'next/link'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function MonthStatus({ stmts, accountsForMonth }: {
  stmts: Statement[]
  accountsForMonth: Account[]
}) {
  const confirmed = stmts.filter(s => s.status === 'confirmed').length
  const total = accountsForMonth.length
  if (total === 0) return <span className="text-gray-300 text-xs">–</span>
  if (confirmed === total) return <span className="text-green-500 text-sm font-medium">✓</span>
  if (stmts.length > 0) return <span className="text-amber-400 text-sm">◑</span>
  return <span className="text-gray-300 text-sm">○</span>
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({
  account, period, categories, rules, onClose, onSaved,
}: {
  account: Account
  period: string  // YYYY-MM
  categories: Category[]
  rules: ImportRule[]
  onClose: () => void
  onSaved: (stmt: Statement) => void
}) {
  const sb = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingRule, setEditingRule] = useState<{ idx: number; keyword: string } | null>(null)
  const [savedRuleKws, setSavedRuleKws] = useState<Set<string>>(new Set(rules.map(r => r.keyword)))

  function handleFile(file: File) {
    const isCard = account.type === 'credit_card'
    parseCSV(file, account.institution, isCard, (parsed, _period) => {
      const withRules = applyRules(parsed, rules, categories)
      setRows(withRules)
    })
  }

  async function saveRule(keyword: string, category_id: string) {
    if (!keyword.trim() || !category_id) return
    const kw = keyword.toLowerCase().trim()
    await sb.from('budget_import_rules').upsert(
      { keyword: kw, entity: account.entity, category_id },
      { onConflict: 'keyword,entity' }
    )
    setSavedRuleKws(s => new Set(s).add(kw))
    setEditingRule(null)
  }

  async function handleSave() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) return
    setSaving(true)
    const { data: { user } } = await sb.auth.getUser()

    // Upsert statement
    const totalIn  = selected.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
    const totalOut = selected.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

    const { data: stmt, error: stmtErr } = await sb
      .from('budget_statements')
      .upsert({ account_id: account.id, period, status: 'pending', tx_count: selected.length, total_in: totalIn, total_out: totalOut }, { onConflict: 'account_id,period' })
      .select()
      .single()

    if (stmtErr || !stmt) { setSaveError(stmtErr?.message ?? 'Failed to save statement'); setSaving(false); return }

    // Delete existing transactions for this statement (re-import)
    await sb.from('budget_transactions').delete().eq('statement_id', stmt.id)

    // Insert transactions
    await sb.from('budget_transactions').insert(
      selected.map(r => ({
        account_id: account.id,
        statement_id: stmt.id,
        category_id: r.category_id || null,
        amount: r.amount,
        type: r.type,
        description: r.description,
        date: r.date,
        entered_by: user!.id,
        tax_type: categories.find(c => c.id === r.category_id)?.tax_type ?? 'none',
        irs_category: categories.find(c => c.id === r.category_id)?.irs_category ?? null,
      }))
    )

    onSaved({ ...stmt, account })
    setSaving(false)
  }

  const catsByEntity = categories.filter(c => {
    if (account.entity === 'glow')      return c.name.startsWith('Glow') || c.name.startsWith('Income')
    if (account.entity === 'acuboost')  return c.name.startsWith('Acuboost') || c.name.startsWith('Income')
    return !c.name.startsWith('Glow') && !c.name.startsWith('Acuboost')
  })

  const selectedCount = rows.filter(r => r.selected).length

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">{account.name}</p>
            <p className="text-xs text-gray-400">{new Date(period + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-5">
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <p className="text-4xl mb-3">⬆️</p>
                <p className="text-sm font-medium text-gray-600">Drop CSV here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{account.institution.replace('_', ' ')} · {account.type.replace('_', ' ')}</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                  <input type="checkbox" checked={r.selected}
                    onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    className="shrink-0 accent-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.description}</p>
                    <p className="text-xs text-gray-400">{r.date}</p>
                  </div>

                  {/* Type toggle */}
                  <select className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-600 shrink-0"
                    value={r.type}
                    onChange={e => setRows(rs => rs.map((x, j) => j === i
                      ? { ...x, type: e.target.value as ParsedRow['type'], category_id: e.target.value === 'transfer' ? '' : x.category_id }
                      : x))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>

                  {/* Category */}
                  {r.type !== 'transfer' && (
                    <select
                      className={`text-xs border rounded-lg px-1.5 py-1 shrink-0 w-36 ${r.category_id ? 'border-gray-200 text-gray-700' : 'border-amber-300 text-amber-600'}`}
                      value={r.category_id}
                      onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, category_id: e.target.value } : x))}>
                      <option value="">Uncategorized</option>
                      {catsByEntity.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name.split(' — ')[1] ?? c.name}</option>)}
                    </select>
                  )}

                  {/* Save-as-rule button */}
                  {r.type !== 'transfer' && (
                    editingRule?.idx === i ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input autoFocus className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-24"
                          value={editingRule.keyword}
                          onChange={e => setEditingRule(x => x ? { ...x, keyword: e.target.value } : null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveRule(editingRule.keyword, r.category_id)
                            if (e.key === 'Escape') setEditingRule(null)
                          }} />
                        <button onClick={() => saveRule(editingRule.keyword, r.category_id)} className="text-green-500 text-xs">✓</button>
                        <button onClick={() => setEditingRule(null)} className="text-gray-300 text-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => r.category_id && setEditingRule({ idx: i, keyword: suggestKeyword(r.description) })}
                        disabled={!r.category_id}
                        className={`shrink-0 text-sm transition-colors ${savedRuleKws.has(suggestKeyword(r.description)) ? 'text-blue-400' : 'text-gray-200 hover:text-blue-300'} disabled:opacity-20`}
                        title="Save as rule">🔖</button>
                    )
                  )}

                  {/* Amount */}
                  <span className={`text-xs font-semibold shrink-0 w-16 text-right ${r.type === 'income' ? 'text-green-600' : r.type === 'transfer' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {r.type === 'income' ? '+' : r.type === 'transfer' ? '↔' : '-'}${r.amount.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-2">
            {saveError && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{selectedCount} transactions</span>
                <span className="text-amber-500">{rows.filter(r => r.selected && !r.category_id && r.type !== 'transfer').length} uncategorized</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setRows([]); setSaveError('') }} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Re-upload</button>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="text-xs px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : `Save ${selectedCount} transactions`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main YearView ────────────────────────────────────────────────────────────
export default function YearView({
  entity,
  accounts,
  statements: initialStatements,
  categories,
  rules: initialRules,
}: {
  entity: Entity
  accounts: Account[]
  statements: Statement[]
  categories: Category[]
  rules: ImportRule[]
}) {
  const [statements, setStatements] = useState(initialStatements)
  const [rules] = useState(initialRules)
  const [year, setYear] = useState(new Date().getFullYear())
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)
  const [uploadTarget, setUploadTarget] = useState<{ account: Account; period: string } | null>(null)

  // Group statements by period
  const stmtMap = new Map<string, Statement[]>()
  for (const s of statements) {
    const list = stmtMap.get(s.period) ?? []
    list.push(s)
    stmtMap.set(s.period, list)
  }

  // Annual totals
  const yearPeriods = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const yearStmts = yearPeriods.flatMap(p => stmtMap.get(p) ?? [])
  const annualIn  = yearStmts.reduce((s, x) => s + Number(x.total_in),  0)
  const annualOut = yearStmts.reduce((s, x) => s + Number(x.total_out), 0)

  function handleSaved(stmt: Statement) {
    setStatements(prev => {
      const without = prev.filter(s => !(s.account_id === stmt.account_id && s.period === stmt.period))
      return [...without, { ...stmt, account: accounts.find(a => a.id === stmt.account_id) }]
    })
    setUploadTarget(null)
    // Expand the month that was just uploaded
    const monthIdx = parseInt(stmt.period.split('-')[1]) - 1
    setExpandedMonth(monthIdx)
  }

  const currentMonth = new Date().getMonth() // 0-indexed
  const currentYear  = new Date().getFullYear()

  return (
    <div className="space-y-1">
      {/* Year selector */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 text-xl px-1">‹</button>
        <span className="text-xl font-bold text-gray-800 min-w-[60px] text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xl px-1">›</button>
        <div className="flex-1" />
        <Link
          href={`/report/${entity}/${year}`}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
          Annual Report →
        </Link>
      </div>

      {/* Annual summary bar */}
      {(annualIn > 0 || annualOut > 0) && (
        <div className="flex gap-4 px-4 py-3 bg-gray-50 rounded-xl mb-4 text-sm">
          <div><span className="text-gray-400 mr-1">In</span><span className="font-semibold text-green-600">{fmt(annualIn)}</span></div>
          <div><span className="text-gray-400 mr-1">Out</span><span className="font-semibold text-red-500">{fmt(annualOut)}</span></div>
          <div><span className="text-gray-400 mr-1">Net</span><span className={`font-semibold ${annualIn - annualOut >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(annualIn - annualOut)}</span></div>
        </div>
      )}

      {/* Month rows */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => {
          const period = `${year}-${String(i + 1).padStart(2, '0')}`
          const monthStmts = stmtMap.get(period) ?? []
          const isFuture = year === currentYear && i > currentMonth
          const monthIn  = monthStmts.reduce((s, x) => s + Number(x.total_in),  0)
          const monthOut = monthStmts.reduce((s, x) => s + Number(x.total_out), 0)
          const isExpanded = expandedMonth === i

          return (
            <div key={i} className={`border-b border-gray-50 last:border-0 ${isFuture ? 'opacity-40' : ''}`}>
              {/* Month row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => !isFuture && setExpandedMonth(isExpanded ? null : i)}
                disabled={isFuture}
              >
                <span className="w-8 text-sm font-medium text-gray-600">{MONTHS[i]}</span>
                <MonthStatus stmts={monthStmts} accountsForMonth={accounts} />
                <div className="flex-1" />
                {monthIn > 0 || monthOut > 0 ? (
                  <div className="flex gap-4 text-xs">
                    {monthIn  > 0 && <span className="text-green-600">+{fmt(monthIn)}</span>}
                    {monthOut > 0 && <span className="text-red-500">-{fmt(monthOut)}</span>}
                    <span className={`font-semibold ${monthIn - monthOut >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {fmt(monthIn - monthOut)}
                    </span>
                  </div>
                ) : (
                  !isFuture && <span className="text-xs text-gray-300">No data</span>
                )}
                {!isFuture && (
                  <span className="text-gray-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>

              {/* Expanded: statement list per account */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 bg-gray-50/50">
                  {accounts.map(acc => {
                    const stmt = monthStmts.find(s => s.account_id === acc.id)
                    return (
                      <div key={acc.id} className="flex items-center gap-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{acc.name}</p>
                          {stmt && (
                            <p className="text-xs text-gray-400">
                              {stmt.tx_count} transactions
                              {stmt.status === 'pending' && <span className="ml-1 text-amber-500">· review pending</span>}
                            </p>
                          )}
                        </div>
                        {stmt ? (
                          <Link
                            href={`/statements/${stmt.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors shrink-0">
                            {stmt.status === 'confirmed' ? '✓ View' : 'Review →'}
                          </Link>
                        ) : (
                          <button
                            onClick={() => setUploadTarget({ account: acc, period })}
                            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors shrink-0">
                            ⬆ Upload
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upload modal */}
      {uploadTarget && (
        <UploadModal
          account={uploadTarget.account}
          period={uploadTarget.period}
          categories={categories}
          rules={rules}
          onClose={() => setUploadTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
