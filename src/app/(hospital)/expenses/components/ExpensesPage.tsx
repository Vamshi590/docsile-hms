"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import { Plus, Settings2, Search, Pencil, Trash2 } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import { getCategories, seedDefaultCategories, getExpensesByDateRange, deleteExpense } from "../actions"
import { ExpenseForm } from "./ExpenseForm"
import { CategoryManager } from "./CategoryManager"
import type { Database } from "@/lib/supabase/types"
type ExpenseCategory = Database["public"]["Tables"]["ExpenseCategory"]["Row"]

type ExpenseWithCategory = {
  id: string
  title: string
  categoryId: string
  amount: number
  date: Date | string
  reason: string | null
  paymentMode: string | null
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
  category: ExpenseCategory
}

type TimeFilter = "today" | "week" | "month" | "custom"

function getDateRange(filter: TimeFilter, customStart: string, customEnd: string) {
  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  switch (filter) {
    case "today":
      return { startDate: todayStr, endDate: todayStr }
    case "week": {
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)
      return { startDate: format(weekAgo, "yyyy-MM-dd"), endDate: todayStr }
    }
    case "month": {
      const monthAgo = new Date(today)
      monthAgo.setMonth(today.getMonth() - 1)
      return { startDate: format(monthAgo, "yyyy-MM-dd"), endDate: todayStr }
    }
    case "custom":
      return { startDate: customStart || todayStr, endDate: customEnd || todayStr }
  }
}

function formatAmountShort(amount: number): string {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M"
  if (amount >= 1000) return (amount / 1000).toFixed(1) + "K"
  return amount.toString()
}

export default function ExpensesPage({
  initialCategories,
  initialExpenses,
}: {
  initialCategories: ExpenseCategory[]
  initialExpenses: ExpenseWithCategory[]
}) {
  const { can } = usePermissions()

  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories)
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>(initialExpenses)
  const [loading, setLoading] = useState(false)

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest")

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  const refreshCategories = useCallback(async () => {
    await seedDefaultCategories()
    const cats = await getCategories()
    setCategories(cats)
  }, [])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(timeFilter, customStart, customEnd)
      const data = await getExpensesByDateRange(startDate, endDate)
      setExpenses(data as ExpenseWithCategory[])
    } finally {
      setLoading(false)
    }
  }, [timeFilter, customStart, customEnd])

  const skipCategoriesFirst = useRef(true)
  useEffect(() => {
    if (skipCategoriesFirst.current) { skipCategoriesFirst.current = false; return }
    refreshCategories()
  }, [refreshCategories])

  const skipExpensesFirst = useRef(true)
  useEffect(() => {
    if (skipExpensesFirst.current) { skipExpensesFirst.current = false; return }
    fetchExpenses()
  }, [fetchExpenses])

  const filteredExpenses = useMemo(() => {
    return [...expenses]
      .filter((expense) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          if (
            !expense.title.toLowerCase().includes(q) &&
            !expense.category.name.toLowerCase().includes(q) &&
            !(expense.reason?.toLowerCase().includes(q) ?? false)
          ) return false
        }
        if (categoryFilter !== "all" && expense.category.name !== categoryFilter) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.date).getTime() - new Date(a.date).getTime()
        if (sortBy === "highest") return b.amount - a.amount
        return a.amount - b.amount
      })
  }, [expenses, searchQuery, categoryFilter, sortBy])

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; color: string }>()
    for (const expense of filteredExpenses) {
      const existing = map.get(expense.category.name)
      if (existing) {
        existing.amount += expense.amount
      } else {
        map.set(expense.category.name, {
          name: expense.category.name,
          amount: expense.amount,
          color: expense.category.color,
        })
      }
    }
    return Array.from(map.values()).filter((c) => c.amount > 0)
  }, [filteredExpenses])

  const handleEdit = (expense: ExpenseWithCategory) => {
    setEditingExpense(expense)
    setShowEditModal(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteExpense(deleteId)
    if (result.success) {
      toast.success("Expense deleted successfully")
      fetchExpenses()
    } else {
      toast.error(result.error)
    }
    setDeleteId(null)
  }

  const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom Range" },
  ]

  const timeFilterLabel = TIME_FILTERS.find(f => f.value === timeFilter)?.label ?? ""

  return (
    <div className="space-y-0">
      <PageHeader title="Expenses" onRefresh={fetchExpenses}>
        <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
          <Settings2 className="h-4 w-4 mr-1.5" />
          Categories
        </Button>
        {can("expenses:create") && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Expense
          </Button>
        )}
      </PageHeader>

      {/* Time filter bar */}
      <div className="rounded-xl border border-border/60 bg-white shadow-sm px-4 py-3 mb-5 mt-4 flex flex-wrap gap-2 items-center">
        {TIME_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timeFilter === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {label}
          </button>
        ))}

        {timeFilter === "custom" && (
          <div className="flex gap-2 items-center ml-1">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-[145px] h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-[145px] h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={fetchExpenses}>Apply</Button>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: chart + total */}
        <div className="lg:col-span-1 space-y-5">

          {/* Pie chart card */}
          <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40">
              <h2 className="text-sm font-semibold text-foreground">Expense Summary</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{timeFilterLabel}</p>
            </div>
            <div className="p-5">
              {loading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <div className="h-64 relative">
                  {expensesByCategory.length > 0 ? (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center flex-col z-10 pointer-events-none">
                        <div className="text-2xl font-bold text-foreground tabular-nums">
                          ₹{formatAmountShort(totalAmount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">Total Spent</div>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expensesByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="88%"
                            paddingAngle={2}
                            dataKey="amount"
                            nameKey="name"
                            isAnimationActive={false}
                          >
                            {expensesByCategory.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            wrapperStyle={{ zIndex: 50, outline: "none" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const item = payload[0]
                              const v = Number(item.value)
                              return (
                                <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-xs min-w-[130px] pointer-events-none">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (item.payload as { color: string }).color }} />
                                    <span className="font-semibold text-foreground">{item.name}</span>
                                  </div>
                                  <div className="text-muted-foreground">{formatCurrency(v)}</div>
                                  <div className="text-muted-foreground/70 text-[10px] mt-0.5">
                                    {((v / totalAmount) * 100).toFixed(1)}% of total
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={7}
                            formatter={(value: string) => (
                              <span className="text-xs text-muted-foreground">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">No expenses in this period</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category breakdown */}
              {!loading && expensesByCategory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  {expensesByCategory.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-foreground">{cat.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {loading && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-2.5 rounded-full" />
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/4 ml-auto" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Total card */}
          <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40">
              <h2 className="text-sm font-semibold text-foreground">Total Expenses</h2>
            </div>
            <div className="px-5 py-4">
              {loading ? (
                <Skeleton className="h-8 w-2/3" />
              ) : (
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(totalAmount)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{timeFilterLabel}</p>
            </div>
          </div>
        </div>

        {/* Right: expense list */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
            {/* List header */}
            <div className="px-5 py-3.5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Expense List</h2>

              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm w-[160px]"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-sm w-[150px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "highest" | "lowest")}>
                  <SelectTrigger className="h-8 text-sm w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="highest">Highest Amount</SelectItem>
                    <SelectItem value="lowest">Lowest Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* List body */}
            <div className="divide-y divide-border/40">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5 w-3/4">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <Skeleton className="h-5 w-1/6" />
                    </div>
                  </div>
                ))
              ) : filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No expenses found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or date range</p>
                </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{expense.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(expense.date), "dd MMM yyyy")}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white shrink-0"
                            style={{ backgroundColor: expense.category.color }}
                          >
                            {expense.category.name}
                          </span>
                          {expense.paymentMode && (
                            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {expense.paymentMode}
                            </span>
                          )}
                        </div>
                        {expense.reason && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{expense.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(expense.amount)}
                        </span>
                        {can("expenses:edit") && (
                          <button
                            onClick={() => handleEdit(expense)}
                            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {can("expenses:delete") && (
                          <button
                            onClick={() => setDeleteId(expense.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer summary */}
            {!loading && filteredExpenses.length > 0 && (
              <div className="px-5 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <ExpenseForm
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchExpenses() }}
        />
      )}

      {showEditModal && editingExpense && (
        <ExpenseForm
          categories={categories}
          expense={editingExpense}
          onClose={() => { setShowEditModal(false); setEditingExpense(null) }}
          onSuccess={() => { setShowEditModal(false); setEditingExpense(null); fetchExpenses() }}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onChanged={refreshCategories}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
