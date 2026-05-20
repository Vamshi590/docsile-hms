import ExpensesPage from "./components/ExpensesPage"
import { getCategories, seedDefaultCategories, getExpensesByDateRange } from "./actions"
import { todayISO } from "@/lib/utils"

export default async function ExpensesRoute() {
  await seedDefaultCategories()
  const today = todayISO()
  const [categories, expenses] = await Promise.all([
    getCategories(),
    getExpensesByDateRange(today, today),
  ])
  return <ExpensesPage initialCategories={categories} initialExpenses={expenses} />
}
