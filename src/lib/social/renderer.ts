// src/lib/social/renderer.ts
import { readFile } from "node:fs/promises"
import path from "node:path"
import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import sharp from "sharp"
import type { ReactElement } from "react"

let fontsCache: Awaited<ReturnType<typeof loadFonts>> | null = null

async function loadFonts() {
  const base = path.join(process.cwd(), "public", "social", "fonts")
  const [regular, semibold, extrabold] = await Promise.all([
    readFile(path.join(base, "Inter-Regular.ttf")),
    readFile(path.join(base, "Inter-SemiBold.ttf")),
    readFile(path.join(base, "Inter-ExtraBold.ttf")),
  ])
  return [
    { name: "Inter", data: regular,   weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold,  weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: extrabold, weight: 800 as const, style: "normal" as const },
  ]
}

export async function renderElementToJpeg(element: ReactElement, width = 1080, height = 1080): Promise<Buffer> {
  if (!fontsCache) fontsCache = await loadFonts()
  const svg = await satori(element, { width, height, fonts: fontsCache })
  const png = new Resvg(svg, { background: "white" }).render().asPng()
  return sharp(png).jpeg({ quality: 90 }).toBuffer()
}
