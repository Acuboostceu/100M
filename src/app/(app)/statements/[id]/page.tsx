import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StatementClient from './StatementClient'
import { Statement, Transaction, Category, ImportRule } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function StatementPage({ params }: { params: { id: string } }) {
  const sb = await createClient()

  const { data: stmt } = await sb
    .from('budget_statements')
    .select('*, account:budget_accounts(*)')
    .eq('id', params.id)
    .single()

  if (!stmt) notFound()

  const entity = (stmt.account as any)?.entity ?? 'personal'

  const [{ data: txs }, { data: categories }, { data: rules }] = await Promise.all([
    sb.from('budget_transactions')
      .select('*, category:budget_categories(*)')
      .eq('statement_id', stmt.id)
      .order('date', { ascending: false }),
    sb.from('budget_categories').select('*').order('name'),
    sb.from('budget_import_rules').select('*, category:budget_categories(*)').eq('entity', entity),
  ])

  return (
    <StatementClient
      statement={stmt as Statement}
      transactions={(txs ?? []) as Transaction[]}
      categories={(categories ?? []) as Category[]}
      rules={(rules ?? []) as ImportRule[]}
    />
  )
}
