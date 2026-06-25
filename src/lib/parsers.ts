import Papa from 'papaparse'
import { Institution } from './types'

export interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income' | 'transfer'
  selected: boolean
  category_id: string
}

function col(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found] !== undefined && row[found] !== '') return row[found]
  }
  return ''
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0]
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
}

function parseAmt(raw: string): number {
  return Math.abs(parseFloat(String(raw).replace(/[,$\s]/g, '')) || 0)
}

function cleanDesc(raw: string): string {
  const orig = raw.match(/ORIG CO NAME:([^O]+?)(?:\s+ORIG ID:|$)/i)
  if (orig) return orig[1].trim()
  const to = raw.match(/\bTo\s+(.+?)(?:\s+\d{2}\/\d{2})?$/i)
  if (to) return to[1].trim()
  return raw.trim()
}

const TRANSFER_KEYWORDS = ['payment', 'autopay', 'auto pay', 'online pmt', 'mobile pmt', 'transfer to', 'transfer from', 'online transfer']

function isTransfer(desc: string): boolean {
  const d = desc.toLowerCase()
  return TRANSFER_KEYWORDS.some(k => d.includes(k))
}

// ── Bank-specific parsers ────────────────────────────────────────────────────

function parseBoA(rows: any[]): ParsedRow[] {
  // BoA Checking: Date, Description, Amount (negative=expense)
  return rows.map(row => {
    const desc = cleanDesc(col(row, 'description', 'payee'))
    const rawAmt = col(row, 'amount')
    const numAmt = parseFloat(String(rawAmt).replace(/[,$]/g, ''))
    const amount = Math.abs(numAmt)
    const date = parseDate(col(row, 'date', 'posted date'))
    const type: ParsedRow['type'] = isTransfer(desc) ? 'transfer' : numAmt > 0 ? 'income' : 'expense'
    return { date, description: desc, amount, type, selected: true, category_id: '' }
  }).filter(r => r.amount > 0)
}

function parseChase(rows: any[], isCard: boolean): ParsedRow[] {
  // Chase Checking: Date, Description, Amount (negative=expense)
  // Chase Credit: Transaction Date, Description, Category, Type, Amount (negative=expense)
  return rows.map(row => {
    const desc = cleanDesc(col(row, 'description', 'merchant'))
    const rawAmt = col(row, 'amount', 'transaction amount')
    const numAmt = parseFloat(String(rawAmt).replace(/[,$]/g, ''))
    const amount = Math.abs(numAmt)
    const date = parseDate(col(row, 'transaction date', 'date', 'posting date'))
    const txTypeCol = col(row, 'type').toLowerCase().trim()

    let type: ParsedRow['type']
    if (txTypeCol === 'sale' || txTypeCol === 'fee') {
      type = 'expense'
    } else if (txTypeCol === 'payment' || txTypeCol === 'return' || txTypeCol === 'adjustment') {
      type = 'transfer'
    } else if (isCard) {
      type = numAmt < 0 ? 'expense' : 'transfer'
    } else {
      type = isTransfer(desc) ? 'transfer' : numAmt > 0 ? 'income' : 'expense'
    }

    return { date, description: desc, amount, type, selected: true, category_id: '' }
  }).filter(r => r.amount > 0)
}

function parseCiti(rows: any[]): ParsedRow[] {
  // Citi: Date, Description, Debit, Credit (separate columns)
  return rows.map(row => {
    const desc = cleanDesc(col(row, 'description'))
    const date = parseDate(col(row, 'date'))
    const debit  = parseAmt(col(row, 'debit'))
    const credit = parseAmt(col(row, 'credit'))

    if (debit > 0) {
      return { date, description: desc, amount: debit, type: 'expense' as const, selected: true, category_id: '' }
    } else {
      const type = isTransfer(desc) ? 'transfer' as const : 'income' as const
      return { date, description: desc, amount: credit, type, selected: true, category_id: '' }
    }
  }).filter(r => r.amount > 0)
}

function parseAmex(rows: any[]): ParsedRow[] {
  // Amex: Date, Description, Amount (positive=expense, negative=payment)
  return rows.map(row => {
    const desc = cleanDesc(col(row, 'description', 'merchant'))
    const rawAmt = col(row, 'amount')
    const numAmt = parseFloat(String(rawAmt).replace(/[,$]/g, ''))
    const amount = Math.abs(numAmt)
    const date = parseDate(col(row, 'date'))
    const type: ParsedRow['type'] = numAmt > 0 ? 'expense' : isTransfer(desc) ? 'transfer' : 'income'
    return { date, description: desc, amount, type, selected: true, category_id: '' }
  }).filter(r => r.amount > 0)
}

function parseCapitalOne(rows: any[]): ParsedRow[] {
  // Capital One: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
  return rows.map(row => {
    const desc = cleanDesc(col(row, 'description'))
    const date = parseDate(col(row, 'transaction date', 'posted date'))
    const debit  = parseAmt(col(row, 'debit'))
    const credit = parseAmt(col(row, 'credit'))

    if (debit > 0) {
      return { date, description: desc, amount: debit, type: 'expense' as const, selected: true, category_id: '' }
    } else {
      const type = isTransfer(desc) ? 'transfer' as const : 'income' as const
      return { date, description: desc, amount: credit, type, selected: true, category_id: '' }
    }
  }).filter(r => r.amount > 0)
}

// ── Auto-detect institution from CSV headers ─────────────────────────────────
function detectInstitution(headers: string[]): Institution | null {
  const h = headers.map(x => x.toLowerCase().trim())
  if (h.includes('debit') && h.includes('credit') && h.includes('card no.')) return 'capital_one'
  if (h.includes('debit') && h.includes('credit') && !h.includes('amount'))  return 'citi'
  if (h.some(x => x.includes('transaction date')) && h.some(x => x.includes('type'))) return 'chase'
  return null
}

// ── Main parse function ───────────────────────────────────────────────────────
export function parseCSV(
  file: File,
  institution: Institution,
  isCard: boolean,
  onComplete: (rows: ParsedRow[], detectedPeriod: string | null) => void
) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const rows = data as Record<string, string>[]
      if (!rows.length) { onComplete([], null); return }

      const headers = Object.keys(rows[0])
      const detected = detectInstitution(headers)
      const inst = detected ?? institution

      let parsed: ParsedRow[]
      if (inst === 'boa')          parsed = parseBoA(rows)
      else if (inst === 'citi')    parsed = parseCiti(rows)
      else if (inst === 'amex')    parsed = parseAmex(rows)
      else if (inst === 'capital_one') parsed = parseCapitalOne(rows)
      else                         parsed = parseChase(rows, isCard)

      // Detect period (YYYY-MM) from first transaction date
      const dates = parsed.map(r => r.date).filter(Boolean).sort()
      const period = dates.length ? dates[0].slice(0, 7) : null

      onComplete(parsed, period)
    },
  })
}

export function applyRules(
  rows: ParsedRow[],
  rules: { keyword: string; category_id: string }[],
  categories: { id: string; tax_type: string }[]
): ParsedRow[] {
  return rows.map(row => {
    if (row.type === 'transfer') return row
    const d = row.description.toLowerCase()
    for (const rule of rules) {
      if (d.includes(rule.keyword.toLowerCase())) {
        return { ...row, category_id: rule.category_id }
      }
    }
    return row
  })
}

export function suggestKeyword(desc: string): string {
  const lower = desc.toLowerCase()
  const orig = lower.match(/orig co name:\s*([^o]+?)(?:\s+orig id:|$)/)
  if (orig) return orig[1].trim()
  const to = lower.match(/\bto\s+(.+?)(?:\s+\d{2}\/\d{2})?$/)
  if (to) return to[1].trim()
  return lower.split(/\s+/).slice(0, 3).join(' ')
}
