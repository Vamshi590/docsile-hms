// Eye-reading prescription JSON normalizer.
//
// The workup form saves both `previousPrescription` and `presentPrescription`
// in the DN shape: `{ re: { d, n }, le: { d, n } }`. Older records (and some
// legacy code paths) used a flat shape: `{ re, le, reNear, leNear }`. The
// receipt renderers expect `{ dist: { rightEye, leftEye }, near: { rightEye, leftEye } }`.
// This helper accepts either input shape and returns the receipt-friendly one.

type EyeCell = { sph: string; cyl: string; axis: string; va: string }
type GlassShape = {
  dist: { rightEye: EyeCell; leftEye: EyeCell }
  near: { rightEye: EyeCell; leftEye: EyeCell }
}

function cell(src: unknown): EyeCell {
  const r = (src ?? {}) as Partial<EyeCell>
  return { sph: r.sph ?? "", cyl: r.cyl ?? "", axis: r.axis ?? "", va: r.va ?? "" }
}

export function toGlassShape(raw: unknown): GlassShape {
  const r = (raw ?? {}) as Record<string, unknown>
  const re = (r.re ?? {}) as Record<string, unknown>
  const le = (r.le ?? {}) as Record<string, unknown>
  // DN shape: re.d / re.n etc. Flat legacy: top-level reNear/leNear.
  const reDist = re.d ?? re
  const reNear = re.n ?? r.reNear
  const leDist = le.d ?? le
  const leNear = le.n ?? r.leNear
  return {
    dist: { rightEye: cell(reDist), leftEye: cell(leDist) },
    near: { rightEye: cell(reNear), leftEye: cell(leNear) },
  }
}
