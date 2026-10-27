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
  categories?: { category: string; amount: number; frequency?: string }[]
}

export interface MonthData {
  month: string
  salary1: number
  salary2: number
  expenses: Transaction[]
  budgets: PayPeriodBudget[]
  startingSavings?: number  // Previous balance carried over
  monthlyBills?: MonthlyBill[]  // Fixed monthly bills with paid status
  manualBudget?: number  // Manual budget per period (overrides auto-calc)
}

export interface MonthlyBill {
  category: Category
  amount: number
  paid: boolean
  dueDate?: number  // Day of month (1-31), optional
}

export const DEFAULT_CATEGORIES: { 
  value: Category; 
  label: string; 
  icon: string; 
  budgetPct: number;
  fixedAmount?: number;
  fixedPerDay?: number;
  frequency?: 'monthly' | 'per-period' | 'daily';
  isMonthlyBill?: boolean;
  dueDate?: number;
}[] = [
  { value: 'Rent', label: 'Rent', icon: '🏠', budgetPct: 0, fixedAmount: 4500, frequency: 'monthly', isMonthlyBill: true, dueDate: 1 },
  { value: 'Food', label: 'Food', icon: '🍚', budgetPct: 0.35 },
  { value: 'Transport', label: 'Transport', icon: '🚌', budgetPct: 0, fixedPerDay: 50, frequency: 'daily' },
  { value: 'Utilities', label: 'Utilities', icon: '💡', budgetPct: 0.05 },
  { value: 'Health', label: 'Health', icon: '💊', budgetPct: 0.05 },
  { value: 'Personal', label: 'Personal', icon: '👤', budgetPct: 0.15 },
  { value: 'Savings', label: 'Savings', icon: '💰', budgetPct: 0.15 },
  { value: 'Other', label: 'Other', icon: '📦', budgetPct: 0 },
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
  // Period 1: 1st-15th (paid by 30th salary from previous month)
  // Period 2: 15th-30th (paid by 15th salary)
  const day = date.getDate()
  return day >= 15 ? 2 : 1
}

export function getCurrentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getPayPeriodLabel(period: 1 | 2): string {
  return period === 1 ? '1st–15th' : '15th–30th'
}

export function getPayPeriodRange(month: string, period: 1 | 2): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number)
  if (period === 1) {
    // Period 1: 1st to 15th (paid by 30th salary from previous month) - 15 days
    return {
      start: new Date(year, monthNum - 1, 1),
      end: new Date(year, monthNum - 1, 15, 23, 59, 59)
    }
  } else {
    // Period 2: 15th to 30th (paid by 15th salary) - 16 days
    return {
      start: new Date(year, monthNum - 1, 15),
      end: new Date(year, monthNum - 1, 30, 23, 59, 59) // 30th of month
    }
  }
}