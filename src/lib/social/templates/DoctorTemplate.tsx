// src/lib/social/templates/DoctorTemplate.tsx
import type { ReactElement } from "react"
import { paletteFor, LABELS, type Palette } from "./shared/tokens"

export type DoctorProps = {
  hospitalName: string
  hospitalLogoUrl: string | null
  doctorName: string
  doctorQualifications: string | null
  doctorAvatarUrl: string | null
  department: string | null
}

export function DoctorTemplate(props: DoctorProps): ReactElement {
  const p: Palette = paletteFor(props.department)
  return (
    <div style={{
      width: 1080, height: 1080, display: "flex", flexDirection: "column",
      backgroundImage: `linear-gradient(135deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`,
      fontFamily: "Inter", color: "white", padding: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {props.hospitalLogoUrl ? (
          <img src={props.hospitalLogoUrl} width={56} height={56} style={{ borderRadius: 14 }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 26,
          }}>{props.hospitalName[0]}</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 600 }}>{props.hospitalName}</div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        flex: 1, justifyContent: "center", gap: 32,
      }}>
        {props.doctorAvatarUrl ? (
          <img src={props.doctorAvatarUrl} width={360} height={360}
               style={{ borderRadius: 180, border: "8px solid rgba(255,255,255,0.5)" }} />
        ) : (
          <div style={{
            width: 360, height: 360, borderRadius: 180,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 140,
          }}>{props.doctorName[0]}</div>
        )}
        <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9 }}>{LABELS.doctor}</div>
        <div style={{ fontSize: 64, fontWeight: 800, textAlign: "center" }}>{props.doctorName}</div>
        {props.doctorQualifications && (
          <div style={{ fontSize: 28, opacity: 0.85 }}>{props.doctorQualifications}</div>
        )}
      </div>
    </div>
  )
}
