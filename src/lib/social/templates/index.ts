// src/lib/social/templates/index.ts
import { renderElementToJpeg } from "../renderer"
import { DoctorTemplate } from "./DoctorTemplate"
import { EducationalSlide } from "./EducationalTemplate"
import { PromoTemplate } from "./PromoTemplate"
import { EngagementTemplate } from "./EngagementTemplate"
import { TrustSlide } from "./TrustTemplate"
import { PhotoOverlayTemplate } from "./PhotoOverlayTemplate"
import type { GeneratedContent, Slide, VisionContent } from "../generation/types"

export type HospitalForRender = {
  name: string
  logoUrl: string | null
}

export type DoctorForRender = {
  fullName: string
  qualifications: string | null
  avatarUrl: string | null
  department: string | null
}

export async function renderAiContent(
  content: GeneratedContent,
  hospital: HospitalForRender,
  doctor: DoctorForRender | null,
): Promise<{ cover: Buffer; slides: Buffer[] }> {
  switch (content.post_type) {
    case "doctor": {
      if (!doctor) throw new Error("Doctor post requires a doctor")
      const buf = await renderElementToJpeg(DoctorTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        doctorName: doctor.fullName, doctorQualifications: doctor.qualifications,
        doctorAvatarUrl: doctor.avatarUrl, department: doctor.department ?? content.department ?? null,
      }))
      return { cover: buf, slides: [] }
    }
    case "promo": {
      const buf = await renderElementToJpeg(PromoTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        department: content.department ?? null, caption: content.caption,
      }))
      return { cover: buf, slides: [] }
    }
    case "engagement": {
      const buf = await renderElementToJpeg(EngagementTemplate({
        hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
        department: content.department ?? null, caption: content.caption,
      }))
      return { cover: buf, slides: [] }
    }
    case "educational":
    case "trust": {
      const slides: Slide[] = content.slides!
      const total = slides.length
      const renderOne = (s: Slide, i: number) =>
        renderElementToJpeg(
          content.post_type === "educational"
            ? EducationalSlide({
                hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
                department: content.department ?? null, slide: s, index: i, total,
              })
            : TrustSlide({
                hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
                department: content.department ?? null, slide: s, index: i, total,
              }),
        )
      const buffers = await Promise.all(slides.map(renderOne))
      return { cover: buffers[0], slides: buffers.slice(1) }
    }
  }
}

export async function renderVisionContent(
  visions: Array<{ content: VisionContent; imageBuffer: Buffer; mimeType: string }>,
  hospital: HospitalForRender,
  department: string | null,
): Promise<{ cover: Buffer; slides: Buffer[] }> {
  const buffers = await Promise.all(visions.map(({ content, imageBuffer, mimeType }) =>
    renderElementToJpeg(PhotoOverlayTemplate({
      hospitalName: hospital.name, hospitalLogoUrl: hospital.logoUrl,
      department, photoDataUri: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
      quote: content.quote ?? content.caption.slice(0, 120),
    })),
  ))
  return { cover: buffers[0], slides: buffers.slice(1) }
}
