import { createClient } from '@/lib/supabase/server'
import YearView from '@/components/YearView'
import { Account, Statement, Category, ImportRule } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PersonalPage() {
  const sb = await createClient()

  const [{ data: accounts }, { data: statements }, { data: categories }, { data: rules }] = await Promise.all([
    sb.from('budget_accounts').select('*').eq('entity', 'personal').order('name'),
    sb.from('budget_statements').select('*, account:budget_accounts(*)').order('period', { ascending: false }),
    sb.from('budget_categories').select('*').order('name'),
    sb.from('budget_import_rules').select('*, category:budget_categories(*)').eq('entity', 'personal'),
  ])

  const accs = (accounts ?? []) as Account[]
  const accIds = new Set(accs.map(a => a.id))
  const stmts = ((statements ?? []) as Statement[]).filter(s => accIds.has(s.account_id))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏠</span>
        <div>
          <h1 className="text-2xl font-bold text-emerald-600">Personal</h1>
          <p className="text-xs text-gray-400">BoA · Capital One · Amex · Citi</p>
        </div>
      </div>
      <YearView
        entity="personal"
        accounts={accs}
        statements={stmts}
        categories={categories as Category[]}
        rules={rules as ImportRule[]}
      />
    </div>
  )
}
