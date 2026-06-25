'use client'
import { Account, Statement, Entity } from '@/lib/types'
import Link from 'next/link'

const ENTITY_CONFIG: Record<Entity, { label: string; color: string; href: string }> = {
  glow:     { label: 'Glow',     color: 'text-sky-600',     href: '/glow' },
  acuboost: { label: 'Acuboost', color: 'text-violet-600',  href: '/acuboost' },
  personal: { label: 'Personal', color: 'text-emerald-600', href: '/personal' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function DashboardClient({
  accounts,
  recentStatements,
  monthStr,
  userName,
}: {
  accounts: Account[]
  recentStatements: Statement[]
  monthStr: string
  userName: string
}) {
  const monthLabel = new Date(monthStr + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Summarize by entity for current month
  const byEntity = (['glow', 'acuboost', 'personal'] as Entity[]).map(entity => {
    const entityAccIds = new Set(accounts.filter(a => a.entity === entity).map(a => a.id))
    const stmts = recentStatements.filter(s => entityAccIds.has(s.account_id))
    const totalIn  = stmts.reduce((s, x) => s + Number(x.total_in),  0)
    const totalOut = stmts.reduce((s, x) => s + Number(x.total_out), 0)
    return { entity, totalIn, totalOut, stmtCount: stmts.length }
  })

  const grandIn  = byEntity.reduce((s, e) => s + e.totalIn,  0)
  const grandOut = byEntity.reduce((s, e) => s + e.totalOut, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Hi {userName} 👋</h1>
        <p className="text-sm text-gray-500">{monthLabel}</p>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total In</p>
          <p className="text-lg font-bold text-green-600">{fmt(grandIn)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total Out</p>
          <p className="text-lg font-bold text-red-500">{fmt(grandOut)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Net</p>
          <p className={`text-lg font-bold ${grandIn - grandOut >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmt(grandIn - grandOut)}
          </p>
        </div>
      </div>

      {/* Per-entity cards */}
      <div className="space-y-3">
        {byEntity.map(({ entity, totalIn, totalOut, stmtCount }) => {
          const cfg = ENTITY_CONFIG[entity]
          return (
            <Link key={entity} href={cfg.href}
              className="card flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {stmtCount > 0 ? `${stmtCount} statement${stmtCount > 1 ? 's' : ''} this month` : 'No statements yet'}
                </p>
              </div>
              {totalIn > 0 || totalOut > 0 ? (
                <div className="text-right">
                  <p className="text-sm text-green-600">+{fmt(totalIn)}</p>
                  <p className="text-xs text-red-500">-{fmt(totalOut)}</p>
                </div>
              ) : (
                <span className="text-xs text-gray-300">→</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
