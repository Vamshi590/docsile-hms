// src/lib/social/templates/EducationalTemplate.tsx
import type { ReactElement, ReactNode } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"
import type { Slide } from "../generation/types"

export type EducationalSlideProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  slide: Slide
  index: number
  total: number
}

function bodyFontSize(text: string, large: boolean): number {
  const len = text.length
  if (large) {
    if (len <= 40) return 76
    if (len <= 80) return 60
    if (len <= 140) return 48
    return 40
  }
  if (len <= 80) return 36
  if (len <= 160) return 30
  if (len <= 260) return 24
  return 20
}

function trim(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…"
}

export function EducationalSlide(props: EducationalSlideProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const isCover = props.index === 0
  const body = trim(props.slide.body ?? "", 320)
  const heading = props.slide.heading ? trim(props.slide.heading, 80) : ""

  // Build the content children as an explicit array so Satori sees an array
  // of direct children of the flex container — avoids React.Fragment edge
  // cases that have caused "expected display: flex" errors.
  const contentChildren: ReactNode[] = []
  if (isCover) {
    contentChildren.push(
      <div key="label" style={{
        fontSize: 28, fontWeight: 600, opacity: 0.85, display: "flex",
      }}>
        {LABELS.educational}
      </div>,
      <div key="body" style={{
        fontSize: bodyFontSize(body, true), fontWeight: 800, lineHeight: 1.12,
        display: "flex", flexWrap: "wrap", width: "100%",
      }}>
        {body}
      </div>,
    )
  } else {
    contentChildren.push(
      <div key="number" style={{
        fontSize: 96, fontWeight: 800, color: p.primary, lineHeight: 1,
        display: "flex",
      }}>
        {String(props.index)}
      </div>,
    )
    if (heading) {
      contentChildren.push(
        <div key="heading" style={{
          fontSize: 44, fontWeight: 700, lineHeight: 1.2,
          display: "flex", flexWrap: "wrap", width: "100%",
        }}>
          {heading}
        </div>,
      )
    }
    contentChildren.push(
      <div key="body" style={{
        fontSize: bodyFontSize(body, false), lineHeight: 1.4,
        display: "flex", flexWrap: "wrap", width: "100%",
      }}>
        {body}
      </div>,
    )
  }

  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      backgroundImage: isCover
        ? `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`
        : "white",
      color: isCover ? "white" : p.dark,
      fontFamily: "Inter", padding: 64,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={48} height={48} style={{ borderRadius: 12 }} />
          : <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: isCover ? "rgba(255,255,255,0.2)" : p.light,
              color: isCover ? "white" : p.primary,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            }}>{props.hospitalName[0]?.toUpperCase() ?? "?"}</div>}
        <div style={{ fontSize: 20, fontWeight: 600, display: "flex" }}>{props.hospitalName}</div>
      </div>

      {/* Body content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", gap: 24,
      }}>
        {contentChildren}
      </div>

      {/* Footer: page counter (single text node via template literal) */}
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 18, opacity: 0.7 }}>
        {`${props.index + 1} / ${props.total}`}
      </div>
    </div>
  )
}
