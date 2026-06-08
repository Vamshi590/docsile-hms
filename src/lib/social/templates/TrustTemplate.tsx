// src/lib/social/templates/TrustTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"
import type { Slide } from "../generation/types"

export type TrustSlideProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  slide: Slide
  index: number
  total: number
}

export function TrustSlide(props: TrustSlideProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      fontFamily: "Inter", padding: 64, background: "white", color: p.dark,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: p.primary, display: "flex" }}>
        {LABELS.trust} · {props.index + 1}/{props.total}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
        <div style={{ fontSize: 120, fontWeight: 800, color: p.light, lineHeight: 0.8 }}>"</div>
        <div style={{ fontSize: 44, lineHeight: 1.4, fontWeight: 500 }}>{props.slide.body}</div>
        {props.slide.heading && (
          <div style={{ fontSize: 26, fontWeight: 600, color: p.primary, marginTop: 12 }}>— {props.slide.heading}</div>
        )}
      </div>
      <div style={{
        height: 96, marginTop: 32, borderRadius: 24, display: "flex",
        alignItems: "center", padding: "0 32px", gap: 16,
        backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
        color: "white",
      }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
          : <div style={{
              width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 24, fontWeight: 700 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
