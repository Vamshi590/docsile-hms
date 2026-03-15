import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/layout/PageSkeleton"

const ExpensesPage = dynamic(() => import("./components/ExpensesPage"), {
  loading: () => <PageSkeleton />,
})

export default async function ExpensesRoute() {
  return <ExpensesPage />
}
