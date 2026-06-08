// src/lib/social/templates/PromoTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type PromoProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line treated as headline; rest as body.
}

function headlineFontSize(text: string): number {
  const len = text.length
  if (len <= 30) return 80
  if (len <= 60) return 62
  if (len <= 100) return 50
  return 42
}

function bodyFontSize(text: string): number {
  const len = text.length
  if (len <= 80) return 32
  if (len <= 180) return 26
  if (len <= 300) return 22
  return 20
}

function trim(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…"
}

export function PromoTemplate(props: PromoProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").map((l) => l.trim()).filter(Boolean)
  const headline = trim(lines[0] ?? props.caption, 130)
  const body = trim(lines.slice(1).join(" "), 360)
  const hSize = headlineFontSize(headline)
  const bSize = bodyFontSize(body)

  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      fontFamily: "Inter",
    }}>
      {/* Top: gradient panel with label + headline */}
      <div style={{
        height: 520, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: 72,
        color: "white", position: "relative",
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
      }}>
        {/* Subtle decorative ring */}
        <div style={{
          position: "absolute", top: -80, right: -80, width: 280, height: 280,
          borderRadius: 280, border: "12px solid rgba(255,255,255,0.18)", display: "flex",
        }} />

        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "6px 14px", borderRadius: 999,
          background: "rgba(255,255,255,0.22)",
          alignSelf: "flex-start",
          fontSize: 20, fontWeight: 700, letterSpacing: 0.6,
          marginBottom: 24,
        }}>
          ✦ {LABELS.promo.toUpperCase()}
        </div>

        <div style={{
          fontSize: hSize, fontWeight: 800, lineHeight: 1.1,
          display: "flex", flexWrap: "wrap", width: "100%",
        }}>
          {headline}
        </div>
      </div>

      {/* Bottom: body + identity strip */}
      <div style={{
        flex: 1, padding: "56px 72px",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        background: "white", color: p.dark,
      }}>
        <div style={{
          fontSize: bSize, lineHeight: 1.45,
          display: "flex", flexWrap: "wrap", width: "100%",
          // Cap visual height — beyond this we'd risk overlapping the identity strip
        }}>
          {body || "Visit us today to learn more."}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          paddingTop: 24,
          borderTop: `1px solid ${p.primary}26`,
        }}>
          {props.hospitalLogoUrl
            ? <img src={props.hospitalLogoUrl} width={60} height={60} style={{ borderRadius: 14 }} />
            : <div style={{
                width: 60, height: 60, borderRadius: 14,
                background: p.light, color: p.primary,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 30,
              }}>{props.hospitalName[0]?.toUpperCase() ?? "?"}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: p.dark }}>{props.hospitalName}</div>
            <div style={{ fontSize: 16, color: p.primary, fontWeight: 600 }}>Call us or book online</div>
          </div>
        </div>
      </div>
    </div>
  )
}
