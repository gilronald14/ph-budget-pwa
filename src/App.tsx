import { useState, useEffect } from 'react'
import { 
  Transaction, MonthData, DEFAULT_CATEGORIES, formatPHP, 
  getCurrentMonthKey, getPayPeriod, PERIOD_LABEL, PERIOD_PAYDAY
} from './types'
import { 
  addTransaction, getTransactionsByMonth, deleteTransaction,
  saveMonthData, getMonthData, getAllMonths
} from './db'
import { 
  calculateMonthSummary, getCategoryBreakdown, getDefaultBudgets, 
  getMonthlyChartData, getPayPeriodProgress, getDefaultMonthlyBills,
  calculateMonthlyBillsPaidStatus, getPeriodTotals, getExpensesForPeriod,
  sortTransactionsNewestFirst
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
  const [showSavingsForm, setShowSavingsForm] = useState<{ period: 1 | 2 } | null>(null)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [activePeriod, setActivePeriod] = useState<1 | 2>(getPayPeriod())
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMonth() }, [month])
  useEffect(() => { loadAllMonths() }, [])

  async function loadMonth() {
    setLoading(true)
    const [txs, stored] = await Promise.all([
      getTransactionsByMonth(month),
      getMonthData(month)
    ])
    // Sorted ONCE, here, newest first by date. Nothing re-orders the list later,
    // so entries no longer jump around from one day to the next.
    setTransactions(sortTransactionsNewestFirst(txs))

    let data = stored
    if (data) {
      let changed = false

      // Months saved with the old single savings value: keep that money in the
      // 1st-15th period instead of showing it in both.
      if (data.savings1 === undefined && data.savings2 === undefined && data.startingSavings) {
        data = { ...data, savings1: data.startingSavings }
        changed = true
      }
      // Always recalculate budgets if manualBudget is set, or if no budgets exist
      if (data.manualBudget || !data.budgets?.length) {
        data = { ...data, budgets: getDefaultBudgets(data) }
        changed = true
      }
      const bills = data.monthlyBills
      if (!bills || bills.length === 0) {
        data = { ...data, monthlyBills: getDefaultMonthlyBills() }
        changed = true
      } else {
        const updatedBills = calculateMonthlyBillsPaidStatus(bills, txs, month)
        if (JSON.stringify(updatedBills) !== JSON.stringify(bills)) {
          data = { ...data, monthlyBills: updatedBills }
          changed = true
        }
      }
      if (changed) await saveMonthData(data)
    }
    setMonthData(data)
    setLoading(false)
  }

  async function loadAllMonths() {
    const months = await getAllMonths()
    setAllMonths(months.sort((a, b) => a.month.localeCompare(b.month)))
  }

  const handleAddExpense = async (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID(), createdAt: Date.now() }
    await addTransaction(newTx)
    setTransactions(sortTransactionsNewestFirst([newTx, ...transactions]))
  }

  const handleDeleteExpense = async (id: string) => {
    await deleteTransaction(id)
    setTransactions(transactions.filter(t => t.id !== id))
  }

  const handleSaveSalary = async (period: 1 | 2, amount: number) => {
    const base: MonthData = monthData 
      ? { ...monthData }
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: [] }
    const updated: MonthData = period === 1 ? { ...base, salary1: amount } : { ...base, salary2: amount }
    // Recalculate budgets (respects manualBudget if set)
    updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowSalaryForm(null)
  }

  const handleSaveSavings = async (period: 1 | 2, amount: number) => {
    const base: MonthData = monthData 
      ? { ...monthData }
      : { month, salary1: 0, salary2: 0, expenses: [], budgets: [] }
    const updated: MonthData = period === 1 ? { ...base, savings1: amount } : { ...base, savings2: amount }
    updated.budgets = getDefaultBudgets(updated)
    await saveMonthData(updated)
    setMonthData(updated)
    setShowSavingsForm(null)
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

  const summary = calculateMonthSummary(monthData, transactions)
  const activeSummary = summary.periodSummaries[activePeriod - 1]
  const totals = getPeriodTotals(transactions)
  const expensesPeriod1 = getExpensesForPeriod(transactions, 1)
  const expensesPeriod2 = getExpensesForPeriod(transactions, 2)
  const categoryData = getCategoryBreakdown(transactions, activePeriod)
  const monthlyChartData = getMonthlyChartData(allMonths, transactions)
  const progress = getPayPeriodProgress(monthData, transactions, activePeriod)

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
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>

      <section className="summary-grid">
        {/* Salary: the active period on top, both periods listed separately below */}
        <div className="card salary clickable" onClick={() => setShowSalaryForm({ period: activePeriod })}>
          <span>Salary {PERIOD_LABEL[activePeriod]}</span>
          <strong>{formatPHP(activeSummary.salary)}</strong>
          <small className="split-line">{PERIOD_LABEL[1]}<b>{formatPHP(summary.periodSummaries[0].salary)}</b></small>
          <small className="split-line">{PERIOD_LABEL[2]}<b>{formatPHP(summary.periodSummaries[1].salary)}</b></small>
        </div>

        {/* Expenses: each period separate, plus one monthly total */}
        <div className="card expenses">
          <span>Expenses {PERIOD_LABEL[activePeriod]}</span>
          <strong>{formatPHP(activeSummary.spent)}</strong>
          <small className="split-line">{PERIOD_LABEL[1]}<b>{formatPHP(totals.period1)}</b></small>
          <small className="split-line">{PERIOD_LABEL[2]}<b>{formatPHP(totals.period2)}</b></small>
          <small className="split-line total">Month total<b>{formatPHP(totals.month)}</b></small>
        </div>

        {/* Savings: two separate inputs, deliberately never added together */}
        <div className="card savings">
          <span>Savings</span>
          <div className="card-rows">
            <button 
              className={summary.savings1 ? 'card-row is-set' : 'card-row'} 
              onClick={() => setShowSavingsForm({ period: 1 })}
            >
              <em>{PERIOD_LABEL[1]}</em><b>{formatPHP(summary.savings1)}</b>
            </button>
            <button 
              className={summary.savings2 ? 'card-row is-set' : 'card-row'} 
              onClick={() => setShowSavingsForm({ period: 2 })}
            >
              <em>{PERIOD_LABEL[2]}</em><b>{formatPHP(summary.savings2)}</b>
            </button>
          </div>
        </div>

        <div className="card balance">
          <span>Total Balance</span>
          <strong className={summary.totalBalance >= 0 ? 'positive' : 'negative'}>{formatPHP(summary.totalBalance)}</strong>
          <small>savings + salary − expenses<br />(both periods combined)</small>
        </div>
      </section>

      {monthData && activeSummary.salary > 0 && (
        <section className="period-progress">
          <h3>{PERIOD_LABEL[activePeriod]} Budget — {PERIOD_PAYDAY[activePeriod]}</h3>
          <PeriodProgressBar {...progress} />

          {/* Monthly Bills (Fixed Monthly Bills - Auto Paid/Unpaid based on expenses) */}
          {monthData.monthlyBills && monthData.monthlyBills.length > 0 && (
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
            <button className={monthData.salary1 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 1 })}>
              Salary {PERIOD_LABEL[1]}: {monthData.salary1 ? formatPHP(monthData.salary1) : 'Set'}
            </button>
            <button className={monthData.salary2 ? 'set' : ''} onClick={() => setShowSalaryForm({ period: 2 })}>
              Salary {PERIOD_LABEL[2]}: {monthData.salary2 ? formatPHP(monthData.salary2) : 'Set'}
            </button>
            <button className={summary.savings1 ? 'set' : ''} onClick={() => setShowSavingsForm({ period: 1 })}>
              Savings {PERIOD_LABEL[1]}: {summary.savings1 ? formatPHP(summary.savings1) : 'Add'}
            </button>
            <button className={summary.savings2 ? 'set' : ''} onClick={() => setShowSavingsForm({ period: 2 })}>
              Savings {PERIOD_LABEL[2]}: {summary.savings2 ? formatPHP(summary.savings2) : 'Add'}
            </button>
            <button className={monthData.manualBudget ? 'set' : ''} onClick={() => setShowBudgetForm(true)}>
              Budget: {monthData.manualBudget ? formatPHP(monthData.manualBudget) : 'Set Budget'}
            </button>
          </div>
        </section>
      )}

      {(!monthData || activeSummary.salary === 0) && (
        <section className="period-progress">
          <h3>{PERIOD_LABEL[activePeriod]}</h3>
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
              Set Salary for {PERIOD_LABEL[activePeriod]}
            </button>
          </div>
        </section>
      )}

      <section className="chart-section">
        <h3>Spending by Category - {PERIOD_LABEL[activePeriod]}</h3>
        <CategoryPieChart data={categoryData.map(d => ({ category: d.category, amount: d.amount }))} />
      </section>

      <section className="expense-section">
        <div className="section-header">
          <h3>Expenses — both periods</h3>
          <button className="fab" onClick={() => setShowExpenseForm(true)}><span>+</span><span className="fab-text"> Add</span></button>
        </div>

        {([1, 2] as const).map(p => {
          const list = p === 1 ? expensesPeriod1 : expensesPeriod2
          const periodTotal = p === 1 ? totals.period1 : totals.period2
          return (
            <div className="period-group" key={p}>
              <div className="period-group-header">
                <span>{PERIOD_LABEL[p]} <em>{PERIOD_PAYDAY[p]}</em></span>
                <strong>{formatPHP(periodTotal)}</strong>
              </div>
              {list.length === 0 ? (
                <p className="empty">No expenses in this period.</p>
              ) : (
                <ul className="expense-list">
                  {list.map(t => (
                    <li key={t.id}>
                      <div className="expense-info">
                        <span className="category-badge">{t.category === 'Other' && t.customCategory ? t.customCategory : DEFAULT_CATEGORIES.find(c => c.value === t.category)?.icon || 'O'}</span>
                        <div>
                          <strong>{t.note || (t.category === 'Other' && t.customCategory ? t.customCategory : t.category)}</strong>
                          <small>{new Date(`${t.date}T00:00:00`).toLocaleDateString('en-PH')}</small>
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
            </div>
          )
        })}

        <div className="month-total-row">
          <span>Total monthly expenses</span>
          <strong>{formatPHP(totals.month)}</strong>
        </div>
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
          month={month} 
          onClose={() => setShowExpenseForm(false)} 
        />
      )}
      {showSalaryForm && (
        <SalaryForm 
          onSubmit={handleSaveSalary} 
          period={showSalaryForm.period} 
          currentAmount={monthData ? (showSalaryForm.period === 1 ? monthData.salary1 : monthData.salary2) : 0} 
          onClose={() => setShowSalaryForm(null)} 
        />
      )}
      {showSavingsForm && (
        <SavingsForm 
          onSubmit={handleSaveSavings} 
          period={showSavingsForm.period} 
          currentAmount={showSavingsForm.period === 1 ? summary.savings1 : summary.savings2} 
          onClose={() => setShowSavingsForm(null)} 
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
