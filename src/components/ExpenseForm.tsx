import { useState, FormEvent } from 'react'
import {
  Transaction, Category, DEFAULT_CATEGORIES,
  PERIOD_LABEL, PERIOD_PAYDAY, getPayPeriodFromDate
} from '../types'

interface Props {
  onSubmit: (tx: Omit<Transaction, 'id'>) => void
  month: string
  onClose: () => void
}

export function ExpenseForm({ onSubmit, month, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('Food')
  const [customCategory, setCustomCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showCustom, setShowCustom] = useState(false)

  // The date decides the period, so an expense can never land in the wrong one.
  const period = getPayPeriodFromDate(date)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return
    const cat = category === 'Other' && customCategory ? 'Other' : category
    onSubmit({
      date,
      payPeriod: period,
      month,
      type: 'expense',
      category: cat,
      customCategory: cat === 'Other' ? customCategory : undefined,
      amount: parseFloat(amount),
      note
    })
    onClose()
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-handle" />
        <h2>Add Expense</h2>
        
        <label>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </label>

        <p className="hint period-hint">
          Counted in <strong>{PERIOD_LABEL[period]}</strong> ({PERIOD_PAYDAY[period]})
        </p>

        <label>
          Amount (₱)
          <input 
            type="number" 
            step="1" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="0"
            required 
            autoFocus
          />
        </label>

        <label>
          Category
          <select value={category} onChange={e => {
            const val = e.target.value as Category
            setCategory(val)
            setShowCustom(val === 'Other')
          }}>
            {DEFAULT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        {showCustom && (
          <label>
            Custom Category
            <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="e.g. Birthday gift" required />
          </label>
        )}

        <label>
          Note (optional)
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Grab, groceries, etc." />
        </label>

        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Add Expense</button>
        </div>
      </form>
    </div>
  )
}

interface SalaryFormProps {
  onSubmit: (period: 1 | 2, amount: number) => void
  period: 1 | 2
  currentAmount: number
  onClose: () => void
}

export function SalaryForm({ onSubmit, period, currentAmount, onClose }: SalaryFormProps) {
  const [amount, setAmount] = useState(currentAmount.toString())

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return
    onSubmit(period, parseFloat(amount))
    onClose()
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-handle" />
        <h2>Salary — {PERIOD_LABEL[period]}</h2>
        <p className="hint">
          Enter net pay (after deductions). Counts for the {PERIOD_LABEL[period]} period only
          ({PERIOD_PAYDAY[period]}) — it is not added to the other period.
        </p>
        
        <label>
          Amount (₱)
          <input 
            type="number" 
            step="1" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="0"
            required 
            autoFocus
          />
        </label>

        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{currentAmount ? 'Update' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

interface SavingsFormProps {
  onSubmit: (period: 1 | 2, amount: number) => void
  period: 1 | 2
  currentAmount: number
  onClose: () => void
}

export function SavingsForm({ onSubmit, period, currentAmount, onClose }: SavingsFormProps) {
  const [amount, setAmount] = useState(currentAmount.toString())

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!amount && amount !== '0') return
    onSubmit(period, parseFloat(amount) || 0)
    onClose()
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-handle" />
        <h2>Savings — {PERIOD_LABEL[period]}</h2>
        <p className="hint">
          Savings kept for the {PERIOD_LABEL[period]} period ({PERIOD_PAYDAY[period]}).
          Each period has its own savings — they are not added together.
        </p>
        
        <label>
          Amount (₱)
          <input 
            type="number" 
            step="1" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="0"
            required 
            autoFocus
          />
        </label>

        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{currentAmount > 0 ? 'Update' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

interface BudgetFormProps {
  onSubmit: (amount: number) => void
  currentAmount: number
  onClose: () => void
}

export function BudgetForm({ onSubmit, currentAmount, onClose }: BudgetFormProps) {
  const [amount, setAmount] = useState(currentAmount.toString())

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!amount && amount !== '0') return
    onSubmit(parseFloat(amount) || 0)
    onClose()
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-handle" />
        <h2>Set Budget (per period)</h2>
        <p className="hint">₱5,000/month = ₱2,500 per period. Overrides auto-calculation.</p>
        
        <label>
          Amount (₱)
          <input 
            type="number" 
            step="1" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="2500"
            required 
            autoFocus
          />
        </label>

        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{currentAmount > 0 ? 'Update' : 'Set'}</button>
        </div>
      </form>
    </div>
  )
}
