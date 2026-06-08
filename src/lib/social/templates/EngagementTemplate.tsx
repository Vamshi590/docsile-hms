// src/lib/social/templates/EngagementTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type EngagementProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  caption: string  // First line is the question
}

// Pick a question font size that won't overflow the 1080×1080 canvas.
// Tuned empirically: at 56px we fit ~120 chars on 3 lines comfortably.
function questionFontSize(text: string): number {
  const len = text.length
  if (len <= 40) return 84
  if (len <= 70) return 70
  if (len <= 110) return 58
  if (len <= 150) return 48
  return 40
}

// Keep the question to a sensible upper bound; AI captions can wander long.
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
      width: 1080, height: 1080, display: "flex",
      background: p.light, fontFamily: "Inter", color: p.dark,
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative geometric shapes — kept smaller and farther off-canvas
          so they don't crowd the central content. */}
      <div style={{
        position: "absolute", top: -120, right: -120, width: 320, height: 320,
        borderRadius: 320, background: p.primary, opacity: 0.14, display: "flex",
      }} />
      <div style={{
        position: "absolute", bottom: -160, left: -160, width: 420, height: 420,
        borderRadius: 420,
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
        opacity: 0.18, display: "flex",
      }} />
      <div style={{
        position: "absolute", top: 180, left: 60, width: 36, height: 36,
        borderRadius: 36, background: p.primary, opacity: 0.4, display: "flex",
      }} />
      <div style={{
        position: "absolute", bottom: 240, right: 80, width: 24, height: 24,
        borderRadius: 24, background: p.primary, opacity: 0.5, display: "flex",
      }} />

      {/* Content layer — sits above the blobs, padded so text never touches edges */}
      <div style={{
        position: "relative", width: 1080, height: 1080,
        display: "flex", flexDirection: "column", padding: 80,
      }}>
        {/* Header: poll label */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            padding: "6px 14px", borderRadius: 999,
            background: p.primary, color: "white",
            fontSize: 22, fontWeight: 700, letterSpacing: 0.4,
            display: "flex",
          }}>
            {LABELS.engagement.toUpperCase()}
          </div>
        </div>

        {/* Question — vertically centered card */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start",
        }}>
          <div style={{
            width: "100%",
            background: "rgba(255,255,255,0.85)",
            borderRadius: 28,
            padding: "44px 48px",
            display: "flex",
            // Subtle border so the card reads as a card on the lightest backgrounds
            border: `1px solid ${p.primary}26`,
          }}>
            <div style={{
              fontSize: qSize, fontWeight: 800, lineHeight: 1.12,
              color: p.dark,
              // Force wrapping inside the card width
              width: "100%",
              display: "flex",
              flexWrap: "wrap",
            }}>
              {question}
            </div>
          </div>
        </div>

        {/* Footer: hospital identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {props.hospitalLogoUrl
            ? <img src={props.hospitalLogoUrl} width={52} height={52} style={{ borderRadius: 14 }} />
            : <div style={{
                width: 52, height: 52, borderRadius: 14, background: p.primary, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 26,
              }}>{props.hospitalName[0]?.toUpperCase() ?? "?"}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: p.dark }}>{props.hospitalName}</div>
            <div style={{ fontSize: 16, color: p.primary, fontWeight: 600 }}>Tell us in the comments ↓</div>
          </div>
        </div>
      </div>
    </div>
  )
}
