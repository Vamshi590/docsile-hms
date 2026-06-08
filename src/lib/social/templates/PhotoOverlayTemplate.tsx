// src/lib/social/templates/PhotoOverlayTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, type Palette } from "./shared/tokens"

export type PhotoOverlayProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  department: string | null
  photoDataUri: string   // data:image/jpeg;base64,...
  quote: string
}

export function PhotoOverlayTemplate(props: PhotoOverlayProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      position: "relative", fontFamily: "Inter",
    }}>
      {/* The photo as background — Satori treats the data URI as an inline image */}
      <img src={props.photoDataUri} width={1080} height={1080}
           style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
      {/* Dark gradient bottom for readable overlay text */}
      <div style={{
        position: "absolute", left: 0, bottom: 0, width: 1080, height: 520,
        backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
      }} />
      {/* Quote text bottom-left */}
      <div style={{
        position: "absolute", bottom: 96, left: 64, right: 64,
        color: "white", display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 0.8, color: p.light }}>"</div>
        <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.3 }}>{props.quote}</div>
      </div>
      {/* Hospital strip top */}
      <div style={{
        position: "absolute", top: 32, left: 32, padding: "12px 20px",
        borderRadius: 16, background: "rgba(255,255,255,0.92)", color: p.dark,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {props.hospitalLogoUrl
          ? <img src={props.hospitalLogoUrl} width={36} height={36} style={{ borderRadius: 8 }} />
          : <div style={{
              width: 36, height: 36, borderRadius: 8, background: p.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18,
            }}>{props.hospitalName[0]}</div>}
        <div style={{ fontSize: 18, fontWeight: 700 }}>{props.hospitalName}</div>
      </div>
    </div>
  )
}
