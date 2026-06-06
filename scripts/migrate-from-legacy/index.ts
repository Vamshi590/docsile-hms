import { SupabaseClient } from "@supabase/supabase-js"
import { config, makeLegacyClient, makeTargetClient } from "./config"
import { hydrateLookups } from "./hydrate"
import { emptyLookups, Lookups } from "./lookups"
import { migrateAttendance } from "./transformers/attendance"
import { migrateDropdowns } from "./transformers/dropdowns"
import { migrateExpenses } from "./transformers/expenses"
import { migrateInpatients } from "./transformers/inpatients"
import { migrateLabs } from "./transformers/labs"
import { migrateMedicineDispense, migrateMedicines } from "./transformers/medicines"
import { migrateOpticalDispense, migrateOpticals } from "./transformers/opticals"
import { migratePatients } from "./transformers/patients"
import { migrateMedicineMaster, migratePredefinedTemplates } from "./transformers/predefined"
import { migratePrescriptions } from "./transformers/prescriptions"
import { migrateStaff } from "./transformers/staff"
import { info } from "./utils"

type Step = {
  name: string
  run: (s: SupabaseClient, t: SupabaseClient, l: Lookups) => Promise<void>
}

// Order matters — later steps depend on earlier steps' lookups
const STEPS: Step[] = [
  { name: "staff", run: migrateStaff },
  { name: "patients", run: migratePatients },
  { name: "dropdowns", run: migrateDropdowns },
  { name: "predefined-templates", run: migratePredefinedTemplates },
  { name: "medicine-master", run: migrateMedicineMaster },
  { name: "medicines", run: migrateMedicines },
  { name: "opticals", run: migrateOpticals },
  { name: "expenses", run: migrateExpenses },
  { name: "attendance", run: migrateAttendance },
  { name: "prescriptions", run: migratePrescriptions },
  { name: "labs", run: migrateLabs },
  { name: "inpatients", run: migrateInpatients },
  { name: "medicine-dispense", run: migrateMedicineDispense },
  { name: "optical-dispense", run: migrateOpticalDispense },
]

async function main() {
  info(`Mode: ${config.dryRun ? "DRY RUN (no writes)" : "LIVE (writes enabled)"}`)
  if (config.only) info(`Only running: ${config.only.join(", ")}`)

  const source = makeLegacyClient()
  const target = makeTargetClient()
  const lookups = emptyLookups()

  await hydrateLookups(source, target, lookups)

  for (const step of STEPS) {
    if (config.only && !config.only.includes(step.name)) continue
    try {
      await step.run(source, target, lookups)
    } catch (err) {
      console.error(`\n✗ Step "${step.name}" failed:`, err)
      throw err
    }
  }

  info("\n✓ Migration finished")
  info(
    `  lookups: users=${lookups.userByUsername.size}, patients=${lookups.patientById.size}, prescriptions=${lookups.prescriptionByPatientDate.size}`,
  )
}

main().catch((err) => {
  console.error("\n✗ Migration failed:", err)
  process.exit(1)
})
