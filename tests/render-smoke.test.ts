import { describe, it, expect } from "vitest"
import { renderElementToJpeg } from "../src/lib/social/renderer"
import { DoctorTemplate } from "../src/lib/social/templates/DoctorTemplate"

describe("doctor template", () => {
  it("renders to a JPEG buffer", async () => {
    const buf = await renderElementToJpeg(DoctorTemplate({
      hospitalName: "Vennela Hospital", hospitalLogoUrl: null,
      doctorName: "Dr. Anita", doctorQualifications: "MS Ophthal", doctorAvatarUrl: null,
      department: "Eye",
    }))
    expect(buf.length).toBeGreaterThan(10_000)        // sanity: it's an image, not empty
    expect(buf[0]).toBe(0xff); expect(buf[1]).toBe(0xd8) // JPEG SOI marker
  })
})
