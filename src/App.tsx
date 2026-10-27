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
  getMonthlyChartData, getPayPeriodProgress, getDefaultMonthlyBills,
  calculateMonthlyBillsPaidStatus
} from './utils'
import { CategoryPieChart, MonthlyBarChart, PeriodProgressBar } from './components/Charts'
import { ExpenseForm, SalaryForm, SavingsForm, BudgetForm } from './components/ExpenseForm'
import './App.css'

function App() {
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthData, setMonthData] = useState<MonthData | undefined>()
  const [allMonths, setAllMonths] = useState<MonthData[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showSalaryForm, setShowSalaryForm] = useState<{ period: 1 | 2 } | null>(null)
  const [showSavingsForm, setShowSavingsForm] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
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
    // Always recalculate budgets if manualBudget is set, or if no budgets exist
    if (mData && (mData.manualBudget || !mData.budgets.length)) {
      const budgets = getDefaultBudgets(mData)
      await saveMonthData({ ...mData, budgets })
      setMonthData({ ...mData, budgets })
    }
    if (mData && !mData.monthlyBills?.length) {
      const monthlyBills = getDefaultMonthlyBills()
      await saveMonthData({ ...mData, monthlyBills })
      setMonthData({ ...mData, monthlyBills })
    }
    // Auto-calculate monthly bills paid status based on expenses
    if (mData && mData.monthlyBills?.length) {
      const updatedBills = calculateMonthlyBillsPaidStatus(mData.monthlyBills, txs, month)
      if (JSON.stringify(updatedBills) !== JSON.stringify(mData.monthlyBills)) {
        const updated = { ...mData, monthlyBills: updatedBills }
        await saveMonthData(updated)
        setMonthData(updated)
      }
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
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: [] }
    updated[`salary${period}`] = amount
    // Recalculate budgets (respects manualBudget if set)
    updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowSalaryForm(null)
  }

  const handleSaveSavings = async (amount: number) => {
    const updated: MonthData = monthData 
      ? { ...monthData, startingSavings: amount }
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: [] }
    updated.startingSavings = amount
    // Recalculate budgets (respects manualBudget if set)
    updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowSavingsForm(false)
  }

  const handleSaveBudget = async (amount: number) => {
    const updated: MonthData = monthData 
      ? { ...monthData, manualBudget: amount }
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: [], manualBudget: amount }
    updated.manualBudget = amount
    // Force budget recalculation with new manual budget
    updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowBudgetForm(false)
  }

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth)
    setActivePeriod(getPayPeriod())
  }

  const summary = monthData ? calculateMonthSummary(monthData, transactions) : { totalSalary: 0, totalExpenses: 0, savings: 0, periodSummaries: [], totalBalance: 0, startingSavings: 0 }
  const currentPeriodExpenses = transactions.filter(t => t.type === 'expense' && t.payPeriod === activePeriod)
  const categoryData = getCategoryBreakdown(transactions, activePeriod)
  const monthlyChartData = getMonthlyChartData(allMonths, transactions)
  const progress = monthData ? getPayPeriodProgress(monthData, transactions, activePeriod) : { spent: 0, budget: 0, pct: 0, daysLeft: 0 }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="app">
      <header>
        <div className="month-nav">
          <button onClick={() => handleMonthChange(prevMonth(month))}>‹</button>
          <button 
            className="month-display" 
            onClick={() => handleMonthChange(getCurrentMonthKey())}
            title="Click to jump to current month"
          >
            {formatMonth(month)}
          </button>
          <button onClick={() => handleMonthChange(nextMonth(month))}>›</button>
        </div>
        <select value={month} onChange={e => handleMonthChange(e.target.value)} style={{display: 'none'}}>
          {generateMonthOptions().map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
        <div className="period-tabs">
          {([1, 2] as const).map((p: 1 | 2) => (
            <button 
              key={p} 
              className={activePeriod === p ? 'active' : ''} 
              onClick={() => setActivePeriod(p)}
            >
              {getPayPeriodLabel(p)}
            </button>
          ))}
        </div>
      </header>

      <section className="summary-grid">
        <div className="card salary clickable" onClick={() => setShowSalaryForm({ period: 1 })}>
          <span>Salary This Month</span>
          <strong>{formatPHP(summary.totalSalary)}</strong>
          <small>15th: {formatPHP(monthData?.salary1 || 0)} • 30th: {formatPHP(monthData?.salary2 || 0)}</small>
        </div>
        <div className="card expenses">
          <span>Total Expenses</span>
          <strong>{formatPHP(summary.totalExpenses)}</strong>
        </div>
        <div className="card savings clickable" onClick={() => setShowSavingsForm(true)}>
          <span>Savings (Carryover)</span>
          <strong>{formatPHP(summary.startingSavings || 0)}</strong>
          <small>{(summary.startingSavings || 0) > 0 
                            ? `Carried from last month`
                            : 'Tap to add savings'}</small>
        </div>
        <div className="card balance">
          <span>Total Balance</span>
          <strong className={summary.totalBalance >= 0 ? 'positive' : 'negative'}>{formatPHP(summary.totalBalance)}</strong>
          <small>Available after bills & expenses</small>
        </div>
      </section>

      {monthData && monthData[`salary${activePeriod}`] > 0 && (
        <section className="period-progress">
          <h3>{getPayPeriodLabel(activePeriod)} Budget</h3>
          <PeriodProgressBar {...progress} />

          {/* Monthly Bills (Fixed Monthly Bills - Auto Paid/Unpaid based on expenses) */}
          {monthData?.monthlyBills && monthData.monthlyBills.length > 0 && (
            <section className="period-progress">
              <h3>Monthly Bills</h3>
              <ul>
                {monthData.monthlyBills.map((bill, idx) => (
                  <li key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                      <span>{DEFAULT_CATEGORIES.find(c => c.value === bill.category)?.icon} {bill.category}</span>
                    </div>
                    <span style={{fontWeight: 600, color: bill.paid ? 'var(--green)' : 'var(--text-muted)'}}>
                      {bill.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="salary-quick">
            {activePeriod === 1 && (
              <>
                <button className={monthData.salary1 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 1 })}>
                  First Salary: {monthData.salary1 ? formatPHP(monthData.salary1) : 'Set Salary'}
                </button>
                <button className={monthData?.startingSavings ? 'set' : ''} onClick={() => setShowSavingsForm(true)}>
                  Savings: {monthData?.startingSavings ? formatPHP(monthData.startingSavings) : 'Add Savings'}
                </button>
                <button className={monthData?.manualBudget ? 'set' : ''} onClick={() => setShowBudgetForm(true)}>
                  Budget: {monthData?.manualBudget ? formatPHP(monthData.manualBudget) : 'Set Budget'}
                </button>
              </>
            )}
            {activePeriod === 2 && (
              <>
                <button className={monthData.salary2 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 2 })}>
                  Second Salary: {monthData.salary2 ? formatPHP(monthData.salary2) : 'Set Salary'}
                </button>
                <button className={monthData?.startingSavings ? 'set' : ''} onClick={() => setShowSavingsForm(true)}>
                  Savings: {monthData?.startingSavings ? formatPHP(monthData.startingSavings) : 'Add Savings'}
                </button>
                <button className={monthData?.manualBudget ? 'set' : ''} onClick={() => setShowBudgetForm(true)}>
                  Budget: {monthData?.manualBudget ? formatPHP(monthData.manualBudget) : 'Set Budget'}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {!monthData || monthData[`salary${activePeriod}`] === 0 ? (
        <section className="period-progress">
          <h3>{getPayPeriodLabel(activePeriod)}</h3>
          <div className="progress-bar">
            <div className="progress-header">
              <span>No salary set for this period</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '0%', background: 'var(--text-muted)' }} />
            </div>
          </div>
          <div className="salary-quick">
            <button onClick={() => setShowSalaryForm({ period: activePeriod })}>
              Set Salary for {getPayPeriodLabel(activePeriod)}
            </button>
          </div>
        </section>
      ) : null}

      <section className="chart-section">
        <h3>Spending by Category - {getPayPeriodLabel(activePeriod)}</h3>
        <CategoryPieChart data={categoryData.map(d => ({ category: d.category, amount: d.amount }))} />
      </section>

      <section className="expense-section">
        <div className="section-header">
          <h3>Expenses - {getPayPeriodLabel(activePeriod)}</h3>
          <button className="fab" onClick={() => setShowExpenseForm(true)}><span>+</span><span className="fab-text"> Add</span></button>
        </div>
        {currentPeriodExpenses.length === 0 ? (
          <p className="empty">No expenses for this period. Tap + to add.</p>
        ) : (
          <ul className="expense-list">
            {currentPeriodExpenses.map(t => (
              <li key={t.id}>
                <div className="expense-info">
                  <span className="category-badge">{t.category === 'Other' && t.customCategory ? t.customCategory : DEFAULT_CATEGORIES.find(c => c.value === t.category)?.icon || 'O'}</span>
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
      {showSavingsForm && (
        <SavingsForm 
          onSubmit={handleSaveSavings} 
          currentAmount={monthData?.startingSavings || 0} 
          onClose={() => setShowSavingsForm(false)} 
        />
      )}
      {showBudgetForm && (
        <BudgetForm 
          onSubmit={handleSaveBudget} 
          currentAmount={monthData?.manualBudget || 2500} 
          onClose={() => setShowBudgetForm(false)} 
        />
      )}
    </div>
  )
}

function prevMonth(month: string) {
  const opts = generateMonthOptions()
  const idx = opts.indexOf(month)
  if (idx > 0) return opts[idx - 1]
  return month
}

function nextMonth(month: string) {
  const opts = generateMonthOptions()
  const idx = opts.indexOf(month)
  if (idx >= 0 && idx < opts.length - 1) return opts[idx + 1]
  return month
}

function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1)
  const monthName = date.toLocaleDateString('en-PH', { month: 'long' })
  return `${monthName} ${y}`
}

function generateMonthOptions() {
  const opts: string[] = []
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  // Show past 12 months up to current month
  for (let i = -12; i <= 0; i++) {
    const d = new Date(currentYear, currentMonth + i, 1)
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return opts
}

export default App