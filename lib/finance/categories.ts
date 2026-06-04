export const INCOME_CATEGORIES = [
  'Client work',
  'Retainer',
  'Stripe payment',
  'Other income',
] as const

export const EXPENSE_CATEGORIES = [
  'Software',
  'Subscriptions',
  'Hardware',
  'Contractors',
  'Stripe fees',
  'Travel',
  'Marketing',
  'Other expense',
] as const

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type TransactionCategory = IncomeCategory | ExpenseCategory

export const ALL_CATEGORIES: readonly TransactionCategory[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
]
