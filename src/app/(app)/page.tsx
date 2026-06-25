import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import { Account, Statement } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [{ data: accounts }, { data: statements }] = await Promise.all([
    sb.from('budget_accounts').select('*').order('entity'),
    sb.from('budget_statements')
      .select('*')
      .eq('period', monthStr),
  ])

  const userName = user?.email?.split('@')[0] ?? 'there'

  return (
    <DashboardClient
      accounts={(accounts ?? []) as Account[]}
      recentStatements={(statements ?? []) as Statement[]}
      monthStr={monthStr}
      userName={userName}
    />
  )
}
