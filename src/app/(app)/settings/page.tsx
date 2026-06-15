import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: accounts } = await supabase
    .from('budget_accounts')
    .select('*')
    .order('created_at')

  return <SettingsClient accounts={accounts ?? []} />
}
