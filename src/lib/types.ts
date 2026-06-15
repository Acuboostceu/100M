export type AccountType = 'personal_card' | 'business_card' | 'joint_account' | 'office_account'
export type Entity = 'glow' | 'acuboost' | 'personal'
export type TxType = 'expense' | 'income' | 'transfer'
export type TaxType = 'personal' | 'business' | 'none'

export interface Account {
  id: string
  name: string
  type: AccountType
  entity: Entity
  balance: number
  credit_limit?: number
  is_debt: boolean
  interest_rate?: number
  minimum_payment?: number
  created_at: string
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
  category_id: string
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
}

export interface DebtPayment {
  id: string
  account_id: string
  amount: number
  payment_date: string
  notes?: string
}

export interface MonthlyBudget {
  id: string
  category_id: string
  month: string
  amount: number
}

export interface ImportRule {
  id: string
  keyword: string
  category_id: string
  created_at: string
  category?: Category
}
