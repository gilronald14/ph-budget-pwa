import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatPHP } from '../types'

interface CategoryData { category: string; amount: number }

export function CategoryPieChart({ data }: { data: CategoryData[] }) {
  if (!data.length) return <div className="chart-empty">No expenses yet</div>
  
  const COLORS = ['#1e90ff', '#32cd32', '#ffa500', '#ff6347', '#9370db', '#00ced1', '#ff69b4', '#ffd700']
  
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="amount"
            nameKey="category"
            label={({ category, percent }: any) => `${category} ${percent ? (percent * 100).toFixed(0) + '%' : ''}`}
            labelLine={false}
          >
            {data.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => [v ? formatPHP(v) : '', '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyBarChart({ data }: { data: { month: string; salary: number; expenses: number; savings: number }[] }) {
  if (!data.length) return <div className="chart-empty">No monthly data yet</div>
  
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
          <XAxis type="number" tickFormatter={v => formatPHP(v)} stroke="#888" fontSize={11} />
          <YAxis dataKey="month" type="category" stroke="#888" fontSize={11} width={60} />
          <Tooltip formatter={(v: any) => [v ? formatPHP(v) : '', '']} />
          <Bar dataKey="salary" fill="#1e90ff" name="Salary" radius={[0, 4, 4, 0]} />
          <Bar dataKey="expenses" fill="#ff6347" name="Expenses" radius={[0, 4, 4, 0]} />
          <Bar dataKey="savings" fill="#32cd32" name="Savings" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PeriodProgressBar({ pct, spent, budget, daysLeft }: { pct: number; spent: number; budget: number; daysLeft: number }) {
  const color = pct >= 100 ? '#ff3d5c' : pct >= 80 ? '#ffa500' : '#32cd32'
  return (
    <div className="progress-bar">
      <div className="progress-header">
        <span>Budget: {formatPHP(budget)}</span>
        <span>Spent: {formatPHP(spent)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <div className="progress-meta">
        <span>{daysLeft} days left in period</span>
        <span>Remaining: {formatPHP(Math.max(0, budget - spent))}</span>
      </div>
    </div>
  )
}