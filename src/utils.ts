import { Transaction, MonthData, PayPeriodBudget, DEFAULT_CATEGORIES, getPayPeriodRange } from './types'

const WORKING_DAYS_PER_PERIOD = 11

export function calculatePeriodBudget(salary: number, _period: 1 | 2): { category: string; amount: number }[] {
  const budgets: { category: string; amount: number }[] = []
  let remaining = salary * 0.85
  
  DEFAULT_CATEGORIES.forEach(cat => {
    let amount = 0
    if (cat.fixedAmount) amount = cat.fixedAmount / 2
    else if (cat.fixedPerDay) amount = cat.fixedPerDay * WORKING_DAYS_PER_PERIOD
    else if (cat.budgetPct > 0) amount = remaining * cat.budgetPct
    if (amount > 0) {
      budgets.push({ category: cat.value, amount: Math.round(amount) })
      remaining -= amount
    }
  })
  
  return budgets
}

export function calculateMonthSummary(monthData: MonthData | undefined, transactions: Transaction[]) {
  if (!monthData) return { totalSalary: 0, totalExpenses: 0, savings: 0, periodSummaries: [] }
  
  const totalSalary = monthData.salary1 + monthData.salary2
  const expenses = transactions.filter(t => t.type === 'expense')
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0)
  const savings = totalSalary - totalExpenses

  const periodSummaries: { period: 1 | 2; salary: number; budget: number; spent: number; remaining: number; pct: number }[] = ([1, 2] as const).map(period => {
    const salary = period === 1 ? monthData.salary1 : monthData.salary2
    const budget = monthData.budgets.find(b => b.period === period)?.allocated || 0
    const periodExpenses = transactions.filter(t => t.type === 'expense' && t.payPeriod === period)
    const spent = periodExpenses.reduce((sum, t) => sum + t.amount, 0)
    return {
      period,
      salary,
      budget,
      spent,
      remaining: budget - spent,
      pct: budget > 0 ? (spent / budget) * 100 : 0
    }
  })

  return { totalSalary, totalExpenses, savings, periodSummaries }
}

export function getCategoryBreakdown(transactions: Transaction[], period?: 1 | 2) {
  let filtered = transactions.filter(t => t.type === 'expense')
  if (period) filtered = filtered.filter(t => t.payPeriod === period)
  
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
    const categoryBudgets = calculatePeriodBudget(salary, period)
    const total = categoryBudgets.reduce((sum, b) => sum + b.amount, 0)
    return { period, allocated: total, categories: categoryBudgets, spent: 0 }
  })
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
  const budget = monthData.budgets.find(b => b.period === period)?.allocated || 0
  const spent = transactions.filter(t => t.type === 'expense' && t.payPeriod === period)
    .reduce((sum, t) => sum + t.amount, 0)
  const { end } = getPayPeriodRange(monthData.month, period)
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
  return { spent, budget, pct: budget > 0 ? (spent / budget) * 100 : 0, daysLeft }
}