// src/lib/social/templates/EngagementTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type EngagementProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line is the question
}

function questionFontSize(text: string): number {
  const len = text.length
  if (len <= 40) return 88
  if (len <= 70) return 72
  if (len <= 110) return 60
  if (len <= 150) return 50
  return 42
}

function trimQuestion(text: string): string {
  const max = 200
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…"
}

export function EngagementTemplate(props: EngagementProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const lines = props.caption.split("\n").map((l) => l.trim()).filter(Boolean)
  const rawQuestion = lines[0] ?? props.caption
  const question = trimQuestion(rawQuestion)
  const qSize = questionFontSize(question)

  return (
    <div style={{
      width: 1080, height: 1080,
      display: "flex", flexDirection: "column",
      background: p.light, fontFamily: "Inter", color: p.dark,
      padding: 80,
    }}>
      {/* Header: poll label only */}
      <div style={{ display: "flex" }}>
        <div style={{
          padding: "8px 18px", borderRadius: 999,
          background: p.primary, color: "white",
          fontSize: 22, fontWeight: 700, letterSpacing: 0.6,
          display: "flex",
        }}>
          {LABELS.engagement.toUpperCase()}
        </div>
      </div>

      {/* Question — centered, sitting directly on the background */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
      }}>
        <div style={{
          fontSize: qSize, fontWeight: 800, lineHeight: 1.14,
          color: p.dark, width: "100%",
          display: "flex", flexWrap: "wrap",
        }}>
          {question}
        </div>
      </div>

      {/* Footer: hospital identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={52} height={52} style={{ borderRadius: 14 }} />
          : <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: p.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 26,
            }}>{props.hospitalName[0]?.toUpperCase() ?? "?"}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: p.dark, display: "flex" }}>
            {props.hospitalName}
          </div>
          <div style={{ fontSize: 16, color: p.primary, fontWeight: 600, display: "flex" }}>
            Tell us in the comments ↓
          </div>
        </div>
      </div>
    </div>
  )
}
