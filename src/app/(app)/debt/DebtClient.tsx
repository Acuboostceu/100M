'use client'
import { useState } from 'react'
import { Account } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function monthsToPayoff(balance: number, monthlyPayment: number, annualRate: number) {
  if (monthlyPayment <= 0 || balance <= 0) return null
  const r = annualRate / 100 / 12
  if (r === 0) return Math.ceil(balance / monthlyPayment)
  return Math.ceil(Math.log(monthlyPayment / (monthlyPayment - r * balance)) / Math.log(1 + r))
}

export default function DebtClient({ debtAccounts, payments }: {
  debtAccounts: Account[]
  payments: any[]
}) {
  const [showLog, setShowLog] = useState(false)
  const [logForm, setLogForm] = useState({ account_id: debtAccounts[0]?.id ?? '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [saving, setSaving] = useState(false)

  const totalDebt = debtAccounts.reduce((s, a) => s + Number(a.balance), 0)

  async function logPayment() {
    if (!logForm.account_id || !logForm.amount) return
    setSaving(true)
    const sb = createClient()
    await sb.from('budget_debt_payments').insert({
      account_id: logForm.account_id,
      amount: parseFloat(logForm.amount),
      payment_date: logForm.date,
      notes: logForm.notes || null,
    })
    await sb.from('budget_accounts').update({ balance: 0 }).eq('id', logForm.account_id)
    setSaving(false)
    setShowLog(false)
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Debt tracker</h1>
        <button onClick={() => setShowLog(true)} className="btn-primary">Log payment</button>
      </div>

      <div className="card text-center">
        <p className="text-xs text-gray-500 mb-1">Total debt</p>
        <p className="text-3xl font-bold text-red-500">{fmt(totalDebt)}</p>
      </div>

      <div className="space-y-3">
        {debtAccounts.map(a => {
          const balance = Number(a.balance)
          const limit = Number(a.credit_limit ?? 0)
          const rate = Number(a.interest_rate ?? 0)
          const minPay = Number(a.minimum_payment ?? 0)
          const pct = limit > 0 ? Math.min((balance / limit) * 100, 100) : 0
          const months = monthsToPayoff(balance, minPay, rate)

          return (
            <div key={a.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-xs text-gray-400">{rate}% APR · min payment {fmt(minPay)}/mo</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-500">{fmt(balance)}</p>
                  {limit > 0 && <p className="text-xs text-gray-400">of {fmt(limit)}</p>}
                </div>
              </div>

              {limit > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Utilization</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 70 ? 'bg-red-400' : pct > 40 ? 'bg-orange-400' : 'bg-green-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {months && (
                <div className="bg-orange-50 rounded-xl p-3 text-sm">
                  <p className="text-orange-700">
                    At minimum payments: <strong>{months} months</strong> to pay off
                    {months > 12 && ` (${(months / 12).toFixed(1)} years)`}
                  </p>
                  <p className="text-xs text-orange-500 mt-1">
                    Doubling your payment would cut that roughly in half.
                  </p>
                </div>
              )}
            </div>
          )
        })}
        {debtAccounts.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-sm text-gray-400">No debt accounts. Add accounts marked as debt in settings.</p>
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3">Payment history</h2>
          <div className="divide-y divide-gray-50">
            {payments.slice(0, 10).map(p => (
              <div key={p.id} className="flex justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{(p.account as any)?.name}</p>
                  <p className="text-xs text-gray-400">{p.payment_date}</p>
                </div>
                <p className="font-semibold text-green-600">{fmt(Number(p.amount))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Log payment</h2>
              <button onClick={() => setShowLog(false)} className="text-gray-400">✕</button>
            </div>
            <div className="space-y-3">
              <select className="input" value={logForm.account_id}
                onChange={e => setLogForm(f => ({ ...f, account_id: e.target.value }))}>
                {debtAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input className="input" type="number" placeholder="Amount paid ($)" value={logForm.amount}
                onChange={e => setLogForm(f => ({ ...f, amount: e.target.value }))} />
              <input className="input" type="date" value={logForm.date}
                onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} />
              <input className="input" placeholder="Notes (optional)" value={logForm.notes}
                onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <button onClick={logPayment} disabled={saving} className="btn-primary w-full py-3">
              {saving ? 'Saving…' : 'Log payment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
