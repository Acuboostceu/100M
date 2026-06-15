import { createClient } from '@/lib/supabase/server'
import EntityClient from '@/components/EntityClient'
import { filterCategories } from '@/lib/entityUtils'

export const dynamic = 'force-dynamic'

export default async function AcuboostPage() {
  const supabase = await createClient()

  const now = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: accounts }, { data: allCategories }, { data: rules }] = await Promise.all([
    supabase.from('budget_accounts').select('*').eq('entity', 'acuboost').order('created_at'),
    supabase.from('budget_categories').select('*').order('name'),
    supabase.from('budget_import_rules').select('*, category:budget_categories(*)'),
  ])

  const accs = accounts ?? []
  const categories = filterCategories(allCategories ?? [], 'acuboost')

  const { data: transactions } = accs.length
    ? await supabase.from('budget_transactions')
        .select('*, category:budget_categories(*), account:budget_accounts(*)')
        .in('account_id', accs.map(a => a.id))
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false })
    : { data: [] }

  return (
    <EntityClient
      entity="acuboost"
      accounts={accs}
      transactions={transactions ?? []}
      categories={categories}
      rules={rules ?? []}
    />
  )
}
