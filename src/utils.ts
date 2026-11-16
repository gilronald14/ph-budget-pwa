import {
  Transaction, MonthData, PayPeriodBudget, DEFAULT_CATEGORIES, getPayPeriodRange,
  MonthlyBill, getTransactionPeriod, getPeriodSavings
} from './types'

const WORKING_DAYS_PER_PERIOD = 11

export interface PeriodSummary {
  period: 1 | 2
  salary: number
  savings: number
  budget: number
  spent: number
  remaining: number
  pct: number
}

export function calculatePeriodBudget(salary: number, _period: 1 | 2): { category: string; amount: number; frequency?: string; isMonthlyBill?: boolean; dueDate?: number }[] {
  const budgets: { category: string; amount: number; frequency?: string; isMonthlyBill?: boolean; dueDate?: number }[] = []
  let remaining = salary * 0.85
  
  DEFAULT_CATEGORIES.forEach(cat => {
    let amount = 0
    let frequency = cat.frequency || 'per-period'
    let isMonthlyBill = cat.isMonthlyBill || false
    let dueDate = cat.dueDate
    
    if (cat.fixedAmount) {
      if (frequency === 'monthly') {
        // Show full monthly amount in budget breakdown
        amount = cat.fixedAmount
      } else {
        // Default: split monthly amount per period
        amount = cat.fixedAmount / 2
      }
    } else if (cat.fixedPerDay) {
      // Daily expenses: calculate per period based on working days
      amount = cat.fixedPerDay * WORKING_DAYS_PER_PERIOD
    } else if (cat.budgetPct > 0) {
      amount = remaining * cat.budgetPct
    }
    
    if (amount > 0) {
      budgets.push({ category: cat.value, amount: Math.round(amount), frequency, isMonthlyBill, dueDate })
      // Only subtract from remaining if it's a per-period budget
      if (frequency !== 'monthly') {
        remaining -= amount
      }
    }
  })
  
  // Add a default manual budget of ₱5,000 per month if no salary-based budget exists (₱2,500 per period)
  if (budgets.length === 0) {
    budgets.push({ category: 'Budget', amount: 2500, frequency: 'per-period' })
  }
  
  return budgets
}

/**
 * Newest first: by date, then by creation time.
 * Returns a NEW array and always produces the same order for the same data, so
 * entries never jump around when a new day arrives.
 */
export function sortTransactionsNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1 // ISO dates sort as text
    return (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })
}

/** Expenses of one single period, newest first. */
export function getExpensesForPeriod(transactions: Transaction[], period: 1 | 2): Transaction[] {
  return sortTransactionsNewestFirst(
    transactions.filter(t => t.type === 'expense' && getTransactionPeriod(t) === period)
  )
}

/** Per-period expense totals, plus the whole-month total. */
export function getPeriodTotals(transactions: Transaction[]) {
  const expenses = transactions.filter(t => t.type === 'expense')
  const period1 = expenses
    .filter(t => getTransactionPeriod(t) === 1)
    .reduce((sum, t) => sum + t.amount, 0)
  const period2 = expenses
    .filter(t => getTransactionPeriod(t) === 2)
    .reduce((sum, t) => sum + t.amount, 0)
  return { period1, period2, month: period1 + period2 }
}

/**
 * Month totals with each pay period kept separate.
 * `totalBalance` is the only figure that spans both periods.
 */
export function calculateMonthSummary(monthData: MonthData | undefined, transactions: Transaction[]) {
  const emptySummaries: PeriodSummary[] = ([1, 2] as const).map(period => ({
    period, salary: 0, savings: 0, budget: 0, spent: 0, remaining: 0, pct: 0
  }))

  if (!monthData) {
    return {
      totalSalary: 0,
      totalExpenses: 0,
      totalBalance: 0,
      savings1: 0,
      savings2: 0,
      periodSummaries: emptySummaries
    }
  }

  const expenses = transactions.filter(t => t.type === 'expense')
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0)
  const totalSalary = monthData.salary1 + monthData.salary2
  const savings1 = getPeriodSavings(monthData, 1)
  const savings2 = getPeriodSavings(monthData, 2)
  const totalBalance = savings1 + savings2 + totalSalary - totalExpenses

  const periodSummaries: PeriodSummary[] = ([1, 2] as const).map(period => {
    const salary = period === 1 ? monthData.salary1 : monthData.salary2
    const savings = period === 1 ? savings1 : savings2
    const budget = monthData.budgets?.find(b => b.period === period)?.allocated || 0
    const spent = expenses
      .filter(t => getTransactionPeriod(t) === period)
      .reduce((sum, t) => sum + t.amount, 0)
    return {
      period,
      salary,
      savings,
      budget,
      spent,
      remaining: budget - spent,
      pct: budget > 0 ? (spent / budget) * 100 : 0
    }
  })

  return { totalSalary, totalExpenses, totalBalance, savings1, savings2, periodSummaries }
}

export function getCategoryBreakdown(transactions: Transaction[], period?: 1 | 2) {
  let filtered = transactions.filter(t => t.type === 'expense')
  if (period) filtered = filtered.filter(t => getTransactionPeriod(t) === period)
  
  const map = new Map<string, { category: string; amount: number; count: number }>()
  
  filtered.forEach(t => {
    const key = t.category === 'Other' && t.customCategory ? t.customCategory : t.category
    const existing = map.get(key) || { category: key, amount: 0, count: 0 }
    existing.amount += t.amount
    existing.count += 1
    map.set(key, existing)
  })
  
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
}

export function getDefaultBudgets(monthData: MonthData): PayPeriodBudget[] {
  return ([1, 2] as const).map(period => {
    const salary = period === 1 ? monthData.salary1 : monthData.salary2
    
    // Use manual budget if set (₱5,000/month = ₱2,500/period default) - takes priority over auto-calc
    if (monthData.manualBudget && monthData.manualBudget > 0) {
      return { 
        period, 
        allocated: monthData.manualBudget, 
        categories: [{ category: 'Budget', amount: monthData.manualBudget, frequency: 'per-period' }], 
        spent: 0 
      }
    }
    
    // Auto-calculate from salary
    const categoryBudgets = calculatePeriodBudget(salary, period)
    const total = categoryBudgets.reduce((sum, b) => sum + b.amount, 0)
    return { period, allocated: total, categories: categoryBudgets, spent: 0 }
  })
}

export function getDefaultMonthlyBills(): MonthlyBill[] {
  return [
    { category: 'Rent', amount: 4500, paid: false },
    { category: 'Utilities', amount: 2000, paid: false },
  ]
}

export function calculateMonthlyBillsPaidStatus(monthlyBills: MonthlyBill[], transactions: Transaction[], month: string): MonthlyBill[] {
  // Check if there's any Rent or Utilities expense in the current month
  const hasRentOrUtilities = transactions.some(t => 
    t.month === month && 
    t.type === 'expense' && 
    (t.category === 'Rent' || t.category === 'Utilities')
  )
  return monthlyBills.map(bill => ({
    ...bill,
    paid: hasRentOrUtilities
  }))
}

export function getMonthlyChartData(months: MonthData[], allTransactions: Transaction[]) {
  return months.map(m => {
    const txs = allTransactions.filter(t => t.month === m.month && t.type === 'expense')
    const totalExpenses = txs.reduce((sum, t) => sum + t.amount, 0)
    const totalSalary = m.salary1 + m.salary2
    return {
      month: m.month,
      salary: totalSalary,
      expenses: totalExpenses,
      savings: totalSalary - totalExpenses
    }
  }).sort((a, b) => a.month.localeCompare(b.month))
}

export function getPayPeriodProgress(monthData: MonthData | undefined, transactions: Transaction[], period: 1 | 2) {
  if (!monthData) return { spent: 0, budget: 0, pct: 0, daysLeft: 0 }
  const budget = monthData.budgets?.find(b => b.period === period)?.allocated || 0
  const spent = transactions
    .filter(t => t.type === 'expense' && getTransactionPeriod(t) === period)
    .reduce((sum, t) => sum + t.amount, 0)
  const { end } = getPayPeriodRange(monthData.month, period)
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
  return { spent, budget, pct: budget > 0 ? (spent / budget) * 100 : 0, daysLeft }
}
