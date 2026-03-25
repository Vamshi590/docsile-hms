"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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

export default function ExpensesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { refreshCategories() }, [refreshCategories])
  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // Client-side filtering and sorting
  const filteredExpenses = useMemo(() => {
    return [...expenses]
      .filter((expense) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const titleMatch = expense.title.toLowerCase().includes(q)
          const catMatch = expense.category.name.toLowerCase().includes(q)
          const reasonMatch = expense.reason?.toLowerCase().includes(q) ?? false
          if (!titleMatch && !catMatch && !reasonMatch) return false
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

  // Category breakdown for pie chart
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

  const handleCustomFilter = () => {
    fetchExpenses()
  }

  const timeFilterLabel = timeFilter === "today" ? "Today" : timeFilter === "week" ? "This Week" : timeFilter === "month" ? "This Month" : "Custom Period"

  return (
    <div className="space-y-0">
      <PageHeader title="Expenses Management" onRefresh={fetchExpenses}>
        <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
          <Settings2 className="h-4 w-4 mr-1.5" />
          Categories
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Expense
        </Button>
      </PageHeader>

      {/* Time filter tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 mt-4">
        <div className="flex flex-wrap gap-3 items-center">
          {(["today", "week", "month", "custom"] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === filter
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filter === "today" ? "Today" : filter === "week" ? "This Week" : filter === "month" ? "This Month" : "Custom Range"}
            </button>
          ))}

          {timeFilter === "custom" && (
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[150px] h-9 text-sm"
              />
              <span className="text-sm text-gray-500">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[150px] h-9 text-sm"
              />
              <Button size="sm" onClick={handleCustomFilter}>
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Pie chart and stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Expense Summary - Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Expense Summary</h2>

            {loading ? (
              <Skeleton className="h-72 w-full rounded-full" />
            ) : (
              <div className="h-72 relative">
                {expensesByCategory.length > 0 ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center flex-col z-10 pointer-events-none">
                      <div className="text-3xl font-bold text-gray-800">
                        ₹{formatAmountShort(totalAmount)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Total Spent</div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensesByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius="65%"
                          outerRadius="95%"
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
                              <div style={{
                                background: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                fontSize: "0.8rem",
                                pointerEvents: "none",
                                minWidth: "140px",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: (item.payload as { color: string }).color, flexShrink: 0 }} />
                                  <span style={{ color: "#374151", fontWeight: 600 }}>{item.name}</span>
                                </div>
                                <div style={{ color: "#6b7280" }}>
                                  {formatCurrency(v)}
                                </div>
                                <div style={{ color: "#9ca3af", fontSize: "0.72rem" }}>
                                  {((v / totalAmount) * 100).toFixed(1)}% of total
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => (
                            <span className="text-xs text-gray-600">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-500 text-sm">No expense data available for the selected period</p>
                  </div>
                )}
              </div>
            )}

            {/* Category breakdown list */}
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-700 mb-3">Expenses by Category</h3>
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/4 ml-auto" />
                    </div>
                  ))
                ) : (
                  expensesByCategory.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Total Expenses Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Total Expenses</h2>
            {loading ? (
              <Skeleton className="h-8 w-1/2 mb-4" />
            ) : (
              <div className="text-3xl font-bold text-gray-800 mb-4">
                {formatCurrency(totalAmount)}
              </div>
            )}
            <div className="text-sm text-gray-500">{timeFilterLabel}</div>
          </div>
        </div>

        {/* Right column - Expense list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h2 className="text-lg font-medium text-gray-800">Expense List</h2>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <Input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm w-full sm:w-[180px]"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-[160px]">
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
                  <SelectTrigger className="h-9 text-sm w-full sm:w-[150px]">
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

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="w-3/4 space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <Skeleton className="h-6 w-1/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No expenses found for the selected filters</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors rounded-lg p-3 group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-800">{expense.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span>{format(new Date(expense.date), "dd MMM yyyy")}</span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: expense.category.color }}
                          >
                            {expense.category.name}
                          </span>
                        </div>
                        {expense.reason && (
                          <p className="text-sm text-gray-600 mt-1.5">{expense.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(expense.amount)}
                        </span>
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-1 text-blue-500 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(expense.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <ExpenseForm
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchExpenses() }}
        />
      )}

      {/* Edit Expense Modal */}
      {showEditModal && editingExpense && (
        <ExpenseForm
          categories={categories}
          expense={editingExpense}
          onClose={() => { setShowEditModal(false); setEditingExpense(null) }}
          onSuccess={() => { setShowEditModal(false); setEditingExpense(null); fetchExpenses() }}
        />
      )}

      {/* Category Manager */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onChanged={refreshCategories}
        />
      )}

      {/* Delete Confirmation */}
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
