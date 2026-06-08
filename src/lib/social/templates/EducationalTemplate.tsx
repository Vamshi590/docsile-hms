// src/lib/social/templates/EducationalTemplate.tsx
import type { ReactElement } from "react"
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

export function EducationalSlide(props: EducationalSlideProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  const isCover = props.index === 0
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      backgroundImage: isCover
        ? `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`
        : "white",
      color: isCover ? "white" : p.dark,
      fontFamily: "Inter", padding: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={48} height={48} style={{ borderRadius: 12 }} />
          : <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: isCover ? "rgba(255,255,255,0.2)" : p.light,
              color: isCover ? "white" : p.primary,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 20, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", gap: 24,
      }}>
        {isCover ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.85 }}>{LABELS.educational}</div>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>{props.slide.body}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 96, fontWeight: 800, color: p.primary, lineHeight: 1 }}>
              {props.index}
            </div>
            {props.slide.heading && (
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{props.slide.heading}</div>
            )}
            <div style={{ fontSize: 32, lineHeight: 1.4 }}>{props.slide.body}</div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 18, opacity: 0.7 }}>
        {props.index + 1} / {props.total}
      </div>
    </div>
  )
}
