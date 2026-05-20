import { cache } from "react"
import { unstable_cache, revalidateTag } from "next/cache"
import { createClient } from "./supabase/server"

// Re-export createClient as the primary DB access method
export { createClient }

const HOSPITAL_PROFILE_TAG = "hospital-profile"

// Cross-instance data cache — survives across Vercel serverless function instances.
// `revalidate: 300` is a safety net: if a tag-bust is ever missed, the value will
// still refresh within 5 minutes.
const fetchHospitalProfile = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data: hospital } = await supabase
      .from("HospitalProfile")
      .select("*")
      .limit(1)
      .single()

    const hospitalName = hospital?.displayName ?? hospital?.name ?? "Docsile HMS"
    return { hospital, hospitalName }
  },
  ["hospital-profile"],
  { tags: [HOSPITAL_PROFILE_TAG], revalidate: 300 }
)

/**
 * Per-request memoization (React cache) on top of the cross-instance data cache
 * (unstable_cache). Same-request callers share a single promise; different
 * requests across instances share the same cached result.
 */
export const getHospitalProfile = cache(fetchHospitalProfile)

/** Call this after updating hospital settings to bust the cache. */
export function invalidateHospitalCache() {
  // Next 16 requires a cache-life profile as the second argument. "max" keeps
  // the new value cached indefinitely (until the next tag bust or the
  // `revalidate: 300` safety net inside unstable_cache fires).
  revalidateTag(HOSPITAL_PROFILE_TAG, "max")
}
