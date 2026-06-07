import { requireServerPermission } from "@/lib/auth"
import AnalyticsPage from "./components/AnalyticsPage"
import {
  getAnalyticsOverview,
  getGenderDistribution,
  getAgeDistribution,
  getRevenueByCategory,
  getExpenseBreakdown,
  getStatusDistribution,
} from "./actions"

export default async function AnalyticsRoute() {
  await requireServerPermission("reports:view")
  const [overview, gender, ageGroups, revenueByCategory, expenseBreakdown, statusDist] =
    await Promise.all([
      getAnalyticsOverview("today"),
      getGenderDistribution("today"),
      getAgeDistribution("today"),
      getRevenueByCategory("today"),
      getExpenseBreakdown("today"),
      getStatusDistribution("today"),
    ])

  return (
    <AnalyticsPage
      initialOverview={overview}
      initialGender={gender}
      initialAgeGroups={ageGroups}
      initialRevenueByCategory={revenueByCategory}
      initialExpenseBreakdown={expenseBreakdown}
      initialStatusDist={statusDist}
    />
  )
}
