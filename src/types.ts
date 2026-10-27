export type Category = 
  | 'Rent' | 'Food' | 'Transport' | 'Utilities' 
  | 'Health' | 'Personal' | 'Savings' | 'Other'

export interface Transaction {
  id: string
  date: string
  payPeriod: number
  month: string
  type: 'salary' | 'expense'
  category: Category
  customCategory?: string
  amount: number
  note?: string
}

export interface PayPeriodBudget {
  period: 1 | 2
  allocated: number
  spent: number
  categories?: { category: string; amount: number }[]
}

export interface MonthData {
  month: string
  salary1: number
  salary2: number
  expenses: Transaction[]
  budgets: PayPeriodBudget[]
}

export const DEFAULT_CATEGORIES: { 
  value: Category; 
  label: string; 
  icon: string; 
  budgetPct: number;
  fixedAmount?: number;
  fixedPerDay?: number;
}[] = [
  { value: 'Rent', label: '🏠 Rent', icon: '🏠', budgetPct: 0, fixedAmount: 4500 },
  { value: 'Food', label: '🍚 Food', icon: '🍚', budgetPct: 0.35 },
  { value: 'Transport', label: '🚌 Transport', icon: '🚌', budgetPct: 0, fixedPerDay: 50 },
  { value: 'Utilities', label: '💡 Utilities', icon: '💡', budgetPct: 0.05 },
  { value: 'Health', label: '💊 Health', icon: '💊', budgetPct: 0.05 },
  { value: 'Personal', label: '👤 Personal', icon: '👤', budgetPct: 0.15 },
  { value: 'Savings', label: '💰 Savings', icon: '💰', budgetPct: 0.15 },
  { value: 'Other', label: '📦 Other', icon: '📦', budgetPct: 0 },
]

export const PAY_DATES = [15, 30]

export function formatPHP(n: number): string {
  return new Intl.NumberFormat('en-PH', { 
    style: 'currency', 
    currency: 'PHP', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(n)
}

export function getPayPeriod(date: Date = new Date()): 1 | 2 {
  return date.getDate() <= 15 ? 1 : 2
}

export function getCurrentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getPayPeriodLabel(period: 1 | 2): string {
  return period === 1 ? '1st–15th' : '16th–End'
}

export function getPayPeriodRange(month: string, period: 1 | 2): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number)
  const startDay = period === 1 ? 1 : 16
  const endDay = period === 1 ? 15 : new Date(year, monthNum, 0).getDate()
  return {
    start: new Date(year, monthNum - 1, startDay),
    end: new Date(year, monthNum - 1, endDay, 23, 59, 59)
  }
}