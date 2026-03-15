import { cache } from "react"
import { createClient } from "./supabase/server"

// Re-export createClient as the primary DB access method
export { createClient }

// In-memory server-side cache for hospital profile (survives across requests)
let cachedHospital: { data: any; hospitalName: string; ts: number } | null = null
const HOSPITAL_CACHE_TTL = 1000 * 60 * 5 // 5 minutes

/** Cached per-request + in-memory — minimal DB hits */
export const getHospitalProfile = cache(async () => {
  if (cachedHospital && Date.now() - cachedHospital.ts < HOSPITAL_CACHE_TTL) {
    return {
      hospital: cachedHospital.data,
      hospitalName: cachedHospital.hospitalName,
    }
  }

  const supabase = await createClient()
  const { data: hospital } = await supabase
    .from("HospitalProfile")
    .select("*")
    .limit(1)
    .single()

  const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
  cachedHospital = { data: hospital, hospitalName, ts: Date.now() }

  return { hospital, hospitalName }
})

/** Call this after updating hospital settings to bust the cache */
export function invalidateHospitalCache() {
  cachedHospital = null
}
