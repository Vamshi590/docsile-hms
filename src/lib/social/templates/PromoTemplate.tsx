// src/lib/social/templates/PromoTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type PromoProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line treated as headline; rest as body.
}

export function PromoTemplate(props: PromoProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").filter((l) => l.trim())
  const headline = lines[0] ?? props.caption
  const body = lines.slice(1).join(" ")

  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      fontFamily: "Inter",
    }}>
      <div style={{
        height: 540, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: 64, color: "white",
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
      }}>
        <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.85, marginBottom: 16 }}>
          {LABELS.promo}
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>{headline}</div>
      </div>
      <div style={{
        flex: 1, padding: 64, display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "white", color: p.dark,
      }}>
        <div style={{ fontSize: 34, lineHeight: 1.4 }}>{body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {props.hospitalLogoUrl
            ? <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
            : <div style={{
                width: 56, height: 56, borderRadius: 14, background: p.light, color: p.primary,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28,
              }}>{props.hospitalName[0]}</div>}
          <div style={{ fontSize: 26, fontWeight: 700 }}>{props.hospitalName}</div>
        </div>
      </div>
    </div>
  )
}
