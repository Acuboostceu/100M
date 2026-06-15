import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const [{ data: accounts }, { data: categories }, { data: rules }] = await Promise.all([
    supabase.from('budget_accounts').select('*').order('created_at'),
    supabase.from('budget_categories').select('*').order('name'),
    supabase.from('budget_import_rules').select('*, category:budget_categories(*)').order('created_at'),
  ])

  return (
    <SettingsClient
      accounts={accounts ?? []}
      categories={categories ?? []}
      rules={rules ?? []}
    />
  )
}
