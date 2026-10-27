import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Transaction, MonthData } from './types'

interface BudgetDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-month': string; 'by-period': string; 'by-category': string }
  }
  months: {
    key: string
    value: MonthData
  }
  settings: {
    key: string
    value: { key: string; value: any }
  }
}

const DB_NAME = 'ph-budget-db'

export async function getDB(): Promise<IDBPDatabase<BudgetDB>> {
  return openDB<BudgetDB>(DB_NAME, 1, {
    upgrade(db) {
      const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
      txStore.createIndex('by-month', 'month')
      txStore.createIndex('by-period', 'payPeriod')
      txStore.createIndex('by-category', 'category')
      db.createObjectStore('months', { keyPath: 'month' })
      db.createObjectStore('settings', { keyPath: 'key' })
    }
  })
}

export async function addTransaction(tx: Transaction) {
  const db = await getDB()
  await db.add('transactions', tx)
}

export async function getTransactionsByMonth(month: string): Promise<Transaction[]> {
  const db = await getDB()
  return db.getAllFromIndex('transactions', 'by-month', month)
}

export async function deleteTransaction(id: string) {
  const db = await getDB()
  await db.delete('transactions', id)
}

export async function saveMonthData(data: MonthData) {
  const db = await getDB()
  await db.put('months', data)
}

export async function getMonthData(month: string): Promise<MonthData | undefined> {
  const db = await getDB()
  return db.get('months', month)
}

export async function getAllMonths(): Promise<MonthData[]> {
  const db = await getDB()
  return db.getAll('months')
}

export async function saveSetting(key: string, value: any) {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getSetting(key: string): Promise<any> {
  const db = await getDB()
  const record = await db.get('settings', key)
  return record?.value
}