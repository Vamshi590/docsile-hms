// src/lib/social/templates/EngagementTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type EngagementProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line is the question
}

export function EngagementTemplate(props: EngagementProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").filter((l) => l.trim())
  const question = lines[0] ?? props.caption
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      background: p.light, fontFamily: "Inter", padding: 64, color: p.dark,
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative geometric shapes */}
      <div style={{
        position: "absolute", top: -80, right: -80, width: 360, height: 360,
        borderRadius: 360, background: p.primary, opacity: 0.18,
      }} />
      <div style={{
        position: "absolute", bottom: -120, left: -120, width: 480, height: 480,
        borderRadius: 480, backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
        opacity: 0.22,
      }} />

      <div style={{ fontSize: 26, fontWeight: 700, color: p.primary, display: "flex" }}>{LABELS.engagement}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>{question}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={48} height={48} style={{ borderRadius: 12 }} />
          : <div style={{
              width: 48, height: 48, borderRadius: 12, background: p.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 22, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
