export type Entity      = 'glow' | 'acuboost' | 'personal'
export type TxType      = 'expense' | 'income' | 'transfer'
export type TaxType     = 'personal' | 'business' | 'none'
export type Institution = 'boa' | 'chase' | 'citi' | 'amex' | 'capital_one' | 'other'
export type Owner       = 'jiyeon' | 'husband' | 'joint'
export type StmtStatus  = 'pending' | 'confirmed'

export interface Account {
  id: string
  user_id: string
  name: string
  entity: Entity
  owner: Owner
  institution: Institution
  type: 'checking' | 'savings' | 'credit_card'
  balance: number
  credit_limit?: number
  created_at: string
}

export interface Statement {
  id: string
  account_id: string
  period: string        // 'YYYY-MM'
  filename?: string
  status: StmtStatus
  tx_count: number
  total_in: number
  total_out: number
  created_at: string
  account?: Account
}

export interface Category {
  id: string
  name: string
  icon: string
  tax_type: TaxType
  irs_category?: string
  color: string
}

export interface Transaction {
  id: string
  account_id: string
  statement_id?: string
  category_id?: string
  amount: number
  type: TxType
  description: string
  date: string
  entered_by: string
  tax_type: TaxType
  irs_category?: string
  notes?: string
  created_at: string
  account?: Account
  category?: Category
  statement?: Statement
}

export interface ImportRule {
  id: string
  keyword: string
  entity: Entity
  category_id: string
  created_at: string
  category?: Category
}
