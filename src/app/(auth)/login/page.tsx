import { LoginForm } from "./login-form"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Hospital } from "lucide-react"

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect("/patients")

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md mb-4">
            <Hospital className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Docsile HMS</h1>
          <p className="text-sm text-muted-foreground mt-1">Hospital Management System</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-5">Enter your credentials to continue</p>
          <LoginForm />
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Docsile HMS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
