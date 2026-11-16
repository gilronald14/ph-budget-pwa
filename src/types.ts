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
  /**
   * Creation time in ms. Used only to keep entries that share the same date in a
   * stable order, so the list never re-shuffles when a new day arrives.
   */
  createdAt?: number
}

export interface PayPeriodBudget {
  period: 1 | 2
  allocated: number
  spent: number
  categories?: { category: string; amount: number; frequency?: string }[]
}

export interface MonthData {
  month: string
  /** Salary belonging to the 1st–15th period (paid out on the 30th) */
  salary1: number
  /** Salary belonging to the 15th–30th period (paid out on the 15th) */
  salary2: number
  expenses: Transaction[]
  budgets: PayPeriodBudget[]
  /** Legacy: one savings value for the whole month. Migrated into savings1 on load. */
  startingSavings?: number
  /** Savings kept for the 1st–15th period. Never added to savings2. */
  savings1?: number
  /** Savings kept for the 15th–30th period. Never added to savings1. */
  savings2?: number
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

/** The two pay periods, always in calendar order. */
export const PAY_PERIODS: (1 | 2)[] = [1, 2]

/** Display name for each pay period. */
export const PERIOD_LABEL: Record<1 | 2, string> = {
  1: '1st–15th',
  2: '15th–30th',
}

/** Which payout funds each period. Secondary text only. */
export const PERIOD_PAYDAY: Record<1 | 2, string> = {
  1: 'from 30th payout',
  2: 'from 15th payout',
}

export function formatPHP(n: number): string {
  return new Intl.NumberFormat('en-PH', { 
    style: 'currency', 
    currency: 'PHP', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(n)
}

/**
 * Which pay period a date falls in.
 * Period 1 = 1st–15th, Period 2 = 15th–30th. The 15th is payday, so it starts
 * the second period.
 */
export function getPayPeriod(date: Date = new Date()): 1 | 2 {
  return date.getDate() >= 15 ? 2 : 1
}

/**
 * Which pay period a "YYYY-MM-DD" string falls in.
 * Parsed at midday so a timezone offset can never shift the day.
 */
export function getPayPeriodFromDate(dateStr: string, fallback: 1 | 2 = 1): 1 | 2 {
  const t = Date.parse(`${dateStr}T12:00:00`)
  if (Number.isNaN(t)) return fallback
  return getPayPeriod(new Date(t))
}

/**
 * Which period a stored transaction belongs to.
 * The DATE is the source of truth, not the stored payPeriod, so entries filed
 * under the wrong tab previously still land in the right period.
 */
export function getTransactionPeriod(t: { date: string; payPeriod: number }): 1 | 2 {
  const fallback: 1 | 2 = t.payPeriod === 1 ? 1 : 2
  return getPayPeriodFromDate(t.date, fallback)
}

/** Savings for one period, migrating the legacy single value into the first one. */
export function getPeriodSavings(m: MonthData | undefined, period: 1 | 2): number {
  if (!m) return 0
  if (period === 1) return m.savings1 ?? m.startingSavings ?? 0
  return m.savings2 ?? 0
}

export function getCurrentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getPayPeriodLabel(period: 1 | 2): string {
  return PERIOD_LABEL[period]
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
