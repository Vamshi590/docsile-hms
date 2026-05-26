export const STORAGE_BUCKET = "license-documents"

export function getLicenseFilePath(licenseId: string, filename: string): string {
  const timestamp = Date.now()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `licenses/${licenseId}/${timestamp}-${safeName}`
}

export function getFilePathFromUrl(documentUrl: string): string {
  const marker = `/object/public/${STORAGE_BUCKET}/`
  const idx = documentUrl.indexOf(marker)
  if (idx === -1) return ""
  return documentUrl.slice(idx + marker.length)
}
