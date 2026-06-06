import { randomUUID } from "node:crypto"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

export function newId(): string {
  return randomUUID().replace(/-/g, "")
}

export function normalizeUsername(u: string | null | undefined): string {
  return (u ?? "").trim().toLowerCase()
}

export function usernameToEmail(u: string | null | undefined): string {
  return `${normalizeUsername(u)}@sheh.com`
}

/** Parse messy text date/datetime into ISO string. Returns null if unparseable or out-of-range. */
export function parseDate(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  // ISO already
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return sanitizeIso(d)
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) {
    const [, dd, mm, yy] = m
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy)
    const d2 = new Date(year, parseInt(mm) - 1, parseInt(dd))
    if (!Number.isNaN(d2.getTime())) return sanitizeIso(d2)
  }
  return null
}

function sanitizeIso(d: Date): string | null {
  const year = d.getUTCFullYear()
  if (year < 1900 || year > 2100) return null
  return d.toISOString()
}

export function parseFloatOrNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = parseFloat(String(v).replace(/,/g, ""))
  return Number.isNaN(n) ? null : n
}

export function parseIntOrNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10)
  return Number.isNaN(n) ? null : n
}

export function trimOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

/** Split full name into first/last on last space. */
export function splitName(full: string | null | undefined): { firstName: string; lastName: string | null } {
  const s = (full ?? "").trim()
  if (!s) return { firstName: "Unknown", lastName: null }
  const parts = s.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] }
}

export async function insertInBatches<T>(
  client: any,
  table: string,
  rows: T[],
  batch = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch)
    const { error } = await client.from(table).insert(slice)
    if (error) throw new Error(`Insert ${table} batch ${i}-${i + slice.length}: ${error.message}`)
  }
}

const LOG_DIR = join(process.cwd(), "scripts", "migrate-from-legacy", "logs")
mkdirSync(LOG_DIR, { recursive: true })
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const ERROR_LOG = join(LOG_DIR, `errors-${runId}.jsonl`)

export function logError(source: string, legacyId: unknown, reason: string, detail?: unknown) {
  const entry = { ts: new Date().toISOString(), source, legacyId, reason, detail }
  appendFileSync(ERROR_LOG, JSON.stringify(entry) + "\n")
  console.error(`  ✗ [${source}] ${legacyId}: ${reason}`)
}

export function info(msg: string) {
  console.log(msg)
}
