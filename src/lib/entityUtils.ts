export type Entity = 'glow' | 'acuboost' | 'personal'

export function filterCategories(categories: any[], entity: Entity) {
  const prefix = entity === 'glow' ? 'Glow' : entity === 'acuboost' ? 'Acuboost' : 'Personal'
  return categories.filter(c => {
    const name: string = c.name
    if (name.startsWith(prefix)) return true
    if (name.startsWith('Income — Glow') && entity === 'glow') return true
    if (name.startsWith('Income — Acuboost') && entity === 'acuboost') return true
    if (entity === 'personal' && (
      name.startsWith('Income — Salary') ||
      name.startsWith('Income — Refund') ||
      name.startsWith('Income — Other')
    )) return true
    return false
  })
}
