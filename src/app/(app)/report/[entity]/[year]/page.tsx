import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReportClient from './ReportClient'
import { Transaction, Category, Entity } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_ENTITIES: Entity[] = ['glow', 'acuboost', 'personal']

export default async function ReportPage({ params }: { params: { entity: string; year: string } }) {
  const entity = params.entity as Entity
  const year   = parseInt(params.year)

  if (!VALID_ENTITIES.includes(entity) || isNaN(year)) notFound()

  const sb = await createClient()

  const { data: accounts } = await sb
    .from('budget_accounts')
    .select('id')
    .eq('entity', entity)

  if (!accounts?.length) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">
        No accounts found for {entity}. Set up accounts in Settings first.
      </div>
    )
  }

  const accIds = accounts.map(a => a.id)
  const from = `${year}-01-01`
  const to   = `${year}-12-31`

  const [{ data: txs }, { data: categories }] = await Promise.all([
    sb.from('budget_transactions')
      .select('*, category:budget_categories(*), account:budget_accounts(*)')
      .in('account_id', accIds)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    sb.from('budget_categories').select('*').order('name'),
  ])

  return (
    <ReportClient
      entity={entity}
      year={year}
      transactions={(txs ?? []) as Transaction[]}
      categories={(categories ?? []) as Category[]}
    />
  )
}
