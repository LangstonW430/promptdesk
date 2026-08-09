export type TransactionType = 'income' | 'expense'
export type TransactionSource = 'manual' | 'stripe'
export type Period = 'thisMonth' | 'thisQuarter' | 'ytd' | 'allTime'
export type RecurringFrequency = 'monthly' | 'quarterly' | 'annual'

export interface TransactionFilters {
  type?: TransactionType
  source?: TransactionSource
  category?: string
  clientId?: string
  projectId?: string
  period?: Period
}

export interface FinancialSummary {
  totalIncome: number
  totalExpense: number
  net: number
}

export interface MonthlyStat {
  year: number
  month: number   // 1–12
  label: string   // "Jan 2026"
  income: number
  expense: number
  net: number
}

export interface CategoryStat {
  category: string
  total: number
  count: number
}

export interface ClientIncomeStat {
  clientId: string | null
  clientName: string | null
  total: number
}

export interface MRRSummary {
  mrr: number           // recurring income this month (Stripe Subscriptions)
  expenses: number      // total expenses this month
  passiveIncome: number // mrr - expenses
}

