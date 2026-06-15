'use client'
import { Account, Transaction } from '@/lib/types'

const ACCOUNT_LABELS: Record<string, string> = {
  personal_card: 'Personal Card',
  business_card: 'Business Card',
  joint_account: 'Joint Account',
  office_account: 'Office Account',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function DashboardClient({
  accounts, recentTransactions, totalIncome, totalExpense, totalDebt, monthStr, userName
}: {
  accounts: Account[]
  recentTransactions: Transaction[]
  totalIncome: number
  totalExpense: number
  totalDebt: number
  monthStr: string
  userName: string
}) {
  const net = totalIncome - totalExpense
  const monthLabel = new Date(monthStr + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hi {userName} 👋</h1>
          <p className="text-sm text-gray-500">{monthLabel}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Income</p>
          <p className="text-lg font-semibold text-green-600">{fmt(totalIncome)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Expenses</p>
          <p className="text-lg font-semibold text-red-500">{fmt(totalExpense)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Net</p>
          <p className={`text-lg font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(net)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total debt</p>
          <p className="text-lg font-semibold text-orange-500">{fmt(totalDebt)}</p>
        </div>
      </div>

      {/* Accounts */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-3">Accounts</h2>
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-gray-400">{ACCOUNT_LABELS[a.type]}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${a.is_debt ? 'text-red-500' : 'text-gray-800'}`}>
                  {fmt(Number(a.balance))}
                </p>
                {a.is_debt && a.credit_limit && (
                  <p className="text-xs text-gray-400">of {fmt(Number(a.credit_limit))}</p>
                )}
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No accounts yet — set up your accounts in settings</p>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent this month</h2>
          <a href="/transactions" className="text-xs text-brand-600">See all →</a>
        </div>
        <div className="space-y-2">
          {recentTransactions.map(t => (
            <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{(t as any).category?.icon ?? '📌'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.date} · {(t as any).account?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {t.tax_type !== 'none' && (
                  <span className={t.tax_type === 'business' ? 'badge-business' : 'badge-personal'}>
                    {t.tax_type}
                  </span>
                )}
                <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                </p>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No transactions this month yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
