"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { loginAction } from "./actions"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const result = await loginAction({
      email: form.get("email") as string,
      password: form.get("password") as string,
    })
    setLoading(false)
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset
        disabled={loading}
        className="space-y-4 disabled:opacity-50 disabled:pointer-events-none transition-opacity duration-150"
      >
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="admin@hospital.com"
            required
            autoComplete="email"
            autoFocus
            className="w-full h-10 px-3.5 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-150 outline-none ring-1 ring-slate-200 hover:ring-slate-300 focus:ring-2 focus:ring-blue-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full h-10 px-3.5 pr-10 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-150 outline-none ring-1 ring-slate-200 hover:ring-slate-300 focus:ring-2 focus:ring-blue-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </fieldset>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600 animate-fade-up">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="relative w-full h-10 mt-1 rounded-lg text-white text-sm font-semibold transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 overflow-hidden group"
        style={{
          background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
          boxShadow: loading
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.2), 0 4px 12px rgba(37,99,235,0.3)",
        }}
      >
        {/* Hover overlay */}
        <span className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-150 pointer-events-none" />

        <span className={`relative flex items-center justify-center transition-all duration-150 ${loading ? "opacity-0" : "opacity-100"}`}>
          Sign in
        </span>

        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
      </button>
    </form>
  )
}
