import AnalyticsPage from "./components/AnalyticsPage"
import {
  getAnalyticsOverview,
  getGenderDistribution,
  getAgeDistribution,
  getRevenueByCategory,
  getTimeSeries,
  getExpenseBreakdown,
  getStatusDistribution,
} from "./actions"

// Default landing: tab="overview", filter="month".
// We SSR-fetch only what the overview tab needs. Other tabs still client-fetch on activation.
export default async function AnalyticsRoute() {
  const [overview, gender, ageGroups, revenueByCategory, timeSeries, expenseBreakdown, statusDist] =
    await Promise.all([
      getAnalyticsOverview("month"),
      getGenderDistribution("month"),
      getAgeDistribution("month"),
      getRevenueByCategory("month"),
      getTimeSeries("month"),
      getExpenseBreakdown("month"),
      getStatusDistribution("month"),
    ])

  return (
    <AnalyticsPage
      initialOverview={overview}
      initialGender={gender}
      initialAgeGroups={ageGroups}
      initialRevenueByCategory={revenueByCategory}
      initialTimeSeries={timeSeries}
      initialExpenseBreakdown={expenseBreakdown}
      initialStatusDist={statusDist}
    />
  )
}
