import { useState, useEffect } from 'react'
import { 
  Transaction, MonthData, DEFAULT_CATEGORIES, formatPHP, 
  getCurrentMonthKey, getPayPeriod, getPayPeriodLabel 
} from './types'
import { 
  addTransaction, getTransactionsByMonth, deleteTransaction,
  saveMonthData, getMonthData, getAllMonths
} from './db'
import { 
  calculateMonthSummary, getCategoryBreakdown, getDefaultBudgets, 
  getMonthlyChartData, getPayPeriodProgress 
} from './utils'
import { CategoryPieChart, MonthlyBarChart, PeriodProgressBar } from './components/Charts'
import { ExpenseForm, SalaryForm } from './components/ExpenseForm'
import './App.css'

function App() {
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthData, setMonthData] = useState<MonthData | undefined>()
  const [allMonths, setAllMonths] = useState<MonthData[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showSalaryForm, setShowSalaryForm] = useState<{ period: 1 | 2 } | null>(null)
  const [activePeriod, setActivePeriod] = useState<1 | 2>(getPayPeriod() as 1 | 2)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMonth() }, [month])
  useEffect(() => { loadAllMonths() }, [])

  async function loadMonth() {
    setLoading(true)
    const [txs, mData] = await Promise.all([
      getTransactionsByMonth(month),
      getMonthData(month)
    ])
    setTransactions(txs.reverse())
    setMonthData(mData)
    if (mData && !mData.budgets.length) {
      const budgets = getDefaultBudgets(mData)
      await saveMonthData({ ...mData, budgets })
      setMonthData({ ...mData, budgets })
    }
    setLoading(false)
  }

  async function loadAllMonths() {
    const months = await getAllMonths()
    setAllMonths(months.sort((a, b) => a.month.localeCompare(b.month)))
  }

  const handleAddExpense = async (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID() }
    await addTransaction(newTx)
    setTransactions([newTx, ...transactions])
  }

  const handleDeleteExpense = async (id: string) => {
    await deleteTransaction(id)
    setTransactions(transactions.filter(t => t.id !== id))
  }

  const handleSaveSalary = async (period: 1 | 2, amount: number) => {
    const updated: MonthData = monthData 
      ? { ...monthData, [`salary${period}`]: amount }
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: getDefaultBudgets({ month, salary1: 0, salary2: 0, expenses: [], budgets: [] }) }
    updated[`salary${period}`] = amount
    if (!updated.budgets.length) updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowSalaryForm(null)
  }

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth)
    setActivePeriod(getPayPeriod())
  }

  const summary = monthData ? calculateMonthSummary(monthData, transactions) : { totalSalary: 0, totalExpenses: 0, savings: 0, periodSummaries: [] }
  const currentPeriodExpenses = transactions.filter(t => t.type === 'expense' && t.payPeriod === activePeriod)
  const categoryData = getCategoryBreakdown(transactions, activePeriod)
  const monthlyChartData = getMonthlyChartData(allMonths, transactions)
  const progress = monthData ? getPayPeriodProgress(monthData, transactions, activePeriod) : { spent: 0, budget: 0, pct: 0, daysLeft: 0 }
  const periodBudget = monthData?.budgets.find(b => b.period === activePeriod)

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="app">
      <header>
        <div className="month-nav">
          <button onClick={() => handleMonthChange(prevMonth(month))}>‹</button>
          <select value={month} onChange={e => handleMonthChange(e.target.value)}>
            {generateMonthOptions().map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
          <button onClick={() => handleMonthChange(nextMonth(month))}>›</button>
        </div>
        <div className="period-tabs">
          {([1, 2] as const).map((p: 1 | 2) => (
            <button 
              key={p} 
              className={activePeriod === p ? 'active' : ''} 
              onClick={() => setActivePeriod(p)}
            >
              {getPayPeriodLabel(p)} {p === getPayPeriod() ? '📍' : ''}
            </button>
          ))}
        </div>
      </header>

      <section className="summary-grid">
        <div className="card salary">
          <span>Salary This Month</span>
          <strong>{formatPHP(summary.totalSalary)}</strong>
          <small>15th: {formatPHP(monthData?.salary1 || 0)} • 30th: {formatPHP(monthData?.salary2 || 0)}</small>
        </div>
        <div className="card expenses">
          <span>Total Expenses</span>
          <strong>{formatPHP(summary.totalExpenses)}</strong>
        </div>
        <div className="card savings">
          <span>Savings</span>
          <strong className={summary.savings >= 0 ? 'positive' : 'negative'}>{formatPHP(summary.savings)}</strong>
          <small>{summary.totalSalary > 0 ? `${((summary.savings / summary.totalSalary) * 100).toFixed(0)}% saved` : 'No salary set'}</small>
        </div>
      </section>

      {monthData && (
        <section className="period-progress">
          <h3>{getPayPeriodLabel(activePeriod)} Budget</h3>
          <PeriodProgressBar {...progress} />
          
          {periodBudget?.categories && (
            <details className="budget-breakdown">
              <summary>Budget breakdown</summary>
              <ul>
                {periodBudget.categories.map(b => (
                  <li key={b.category}>
                    <span>{DEFAULT_CATEGORIES.find(c => c.value === b.category)?.icon} {b.category}</span>
                    <span>{formatPHP(b.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          
          <div className="salary-quick">
            <button className={monthData.salary1 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 1 })}>
              15th: {monthData.salary1 ? formatPHP(monthData.salary1) : 'Set Salary'}
            </button>
            <button className={monthData.salary2 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 2 })}>
              30th: {monthData.salary2 ? formatPHP(monthData.salary2) : 'Set Salary'}
            </button>
          </div>
        </section>
      )}

      <section className="chart-section">
        <h3>Spending by Category - {getPayPeriodLabel(activePeriod)}</h3>
        <CategoryPieChart data={categoryData.map(d => ({ category: d.category, amount: d.amount }))} />
      </section>

      <section className="expense-section">
        <div className="section-header">
          <h3>Expenses - {getPayPeriodLabel(activePeriod)}</h3>
          <button className="fab" onClick={() => setShowExpenseForm(true)}>+ Add</button>
        </div>
        {currentPeriodExpenses.length === 0 ? (
          <p className="empty">No expenses for this period. Tap + to add.</p>
        ) : (
          <ul className="expense-list">
            {currentPeriodExpenses.map(t => (
              <li key={t.id}>
                <div className="expense-info">
                  <span className="category-badge">{t.category === 'Other' && t.customCategory ? t.customCategory : DEFAULT_CATEGORIES.find(c => c.value === t.category)?.icon || '📦'}</span>
                  <div>
                    <strong>{t.note || (t.category === 'Other' && t.customCategory ? t.customCategory : t.category)}</strong>
                    <small>{new Date(t.date).toLocaleDateString('en-PH')}</small>
                  </div>
                </div>
                <div className="expense-right">
                  <span className="amount">−{formatPHP(t.amount)}</span>
                  <button onClick={() => handleDeleteExpense(t.id)}>🗑</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {allMonths.length > 0 && (
        <section className="chart-section">
          <h3>Monthly Overview</h3>
          <MonthlyBarChart data={monthlyChartData} />
        </section>
      )}

      {showExpenseForm && (
        <ExpenseForm 
          onSubmit={handleAddExpense} 
          period={activePeriod} 
          month={month} 
          onClose={() => setShowExpenseForm(false)} 
        />
      )}
      {showSalaryForm && (
        <SalaryForm 
          onSubmit={handleSaveSalary} 
          period={showSalaryForm.period} 
          currentAmount={monthData?.[`salary${showSalaryForm.period}`] || 0} 
          onClose={() => setShowSalaryForm(null)} 
        />
      )}
    </div>
  )
}

function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
}
function generateMonthOptions() {
  const opts: string[] = []
  const now = new Date()
  for (let i = -12; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return opts.reverse()
}

export default App