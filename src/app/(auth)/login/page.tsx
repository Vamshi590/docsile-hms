import { LoginForm } from "./login-form"
import { Hospital } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel ───────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[480px] xl:w-[520px] flex-shrink-0 flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 65%, #2563eb 100%)" }}
      >
        {/* Glow blobs */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-10 -left-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(129,140,248,0.10) 0%, transparent 70%)" }}
        />

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='white'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative flex flex-col h-full px-10 py-12 xl:px-12">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10">
              <Hospital className="h-4 w-4 text-white" />
            </div>
            <span className="text-white/80 font-semibold text-sm tracking-tight">Docsile HMS</span>
          </div>

          {/* Illustration + copy */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-[320px] xl:max-w-[360px]">
              <Image
                src="/doctor-illustration.svg"
                alt="Doctors"
                width={360}
                height={300}
                priority
                className="w-full h-auto"
              />
            </div>
            <div className="mt-6 text-center max-w-[280px]">
              <p className="text-white/90 text-lg font-semibold leading-snug tracking-tight">
                Your hospital, fully connected
              </p>
              <p className="text-blue-200/60 text-sm mt-2 leading-relaxed">
                OPD · IPD · Pharmacy · Labs · Billing — one platform, every workflow.
              </p>
            </div>
          </div>

          {/* Bottom version tag */}
          <p className="text-blue-200/30 text-xs text-center">
            Docsile HMS &copy; {new Date().getFullYear()}
          </p>

        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] p-8">
        <div className="w-full max-w-[380px]">

          {/* Logo — desktop hidden (already on left), shown on mobile */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10 animate-fade-up">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Hospital className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">Docsile HMS</span>
          </div>

          {/* Heading */}
          <div className="mb-7 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="text-slate-500 mt-1 text-sm">Enter your credentials to continue</p>
          </div>

          {/* Form */}
          <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <LoginForm />
          </div>

        </div>
      </div>

    </div>
  )
}
