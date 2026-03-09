import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

function hashPassword(password: string): string {
  return Buffer.from(password).toString("base64")
}

async function main() {
  console.log("🌱 Seeding Docsile HMS database...")

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const admin = await db.user.upsert({
    where: { email: "admin@docsile.com" },
    update: {},
    create: {
      email: "admin@docsile.com",
      passwordHash: hashPassword("admin123"),
      fullName: "Dr. Admin",
      phone: "9999999999",
      role: "ADMIN",
      department: "Administration",
      designation: "Hospital Administrator",
      isActive: true,
    },
  })
  console.log(`✅ Admin user: ${admin.email} (password: admin123)`)

  // Doctor user
  const doctor = await db.user.upsert({
    where: { email: "doctor@docsile.com" },
    update: {},
    create: {
      email: "doctor@docsile.com",
      passwordHash: hashPassword("doctor123"),
      fullName: "Dr. Rajesh Kumar",
      phone: "9888888888",
      role: "DOCTOR",
      department: "Ophthalmology",
      designation: "Senior Ophthalmologist",
      isActive: true,
    },
  })
  console.log(`✅ Doctor user: ${doctor.email} (password: doctor123)`)

  // Receptionist user
  await db.user.upsert({
    where: { email: "reception@docsile.com" },
    update: {},
    create: {
      email: "reception@docsile.com",
      passwordHash: hashPassword("reception123"),
      fullName: "Priya Sharma",
      phone: "9777777777",
      role: "RECEPTIONIST",
      designation: "Front Desk",
      isActive: true,
    },
  })
  console.log(`✅ Reception user: reception@docsile.com (password: reception123)`)

  // ─── Hospital Profile ────────────────────────────────────────────────────────
  await db.hospitalProfile.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      name: "Docsile Eye Hospital",
      displayName: "Docsile Eye Care",
      address: JSON.stringify({
        line1: "123 Medical Lane",
        line2: "Sector 5",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500001",
      }),
      phone: "040-12345678",
      email: "info@docsileeye.com",
      website: "www.docsileeye.com",
      registrationNo: "MCI-2024-001",
      gstin: "36AAACD1234F1ZA",
      settings: JSON.stringify({
        patientIdPrefix: "OP",
        invoicePrefix: "INV",
        currency: "INR",
        currencySymbol: "₹",
      }),
    },
  })
  console.log(`✅ Hospital profile created`)

  // ─── Service Templates ───────────────────────────────────────────────────────
  const services = [
    // Consultation
    { name: "General Consultation", category: "Consultation", amount: 300, sortOrder: 1 },
    { name: "Senior Consultation", category: "Consultation", amount: 500, sortOrder: 2 },
    { name: "Follow-up Consultation", category: "Consultation", amount: 150, sortOrder: 3 },

    // Diagnostic
    { name: "Auto Refractometry (AR)", category: "Diagnostic", amount: 100, sortOrder: 10 },
    { name: "Visual Acuity Test", category: "Diagnostic", amount: 50, sortOrder: 11 },
    { name: "Slit Lamp Examination", category: "Diagnostic", amount: 150, sortOrder: 12 },
    { name: "Fundus Examination", category: "Diagnostic", amount: 200, sortOrder: 13 },
    { name: "IOP (Tonometry)", category: "Diagnostic", amount: 100, sortOrder: 14 },
    { name: "A-Scan Biometry", category: "Diagnostic", amount: 500, sortOrder: 15 },
    { name: "B-Scan Ultrasonography", category: "Diagnostic", amount: 600, sortOrder: 16 },
    { name: "Fundus Photography", category: "Diagnostic", amount: 400, sortOrder: 17 },
    { name: "OCT - Macula", category: "Diagnostic", amount: 1200, sortOrder: 18 },
    { name: "OCT - Optic Nerve", category: "Diagnostic", amount: 1200, sortOrder: 19 },
    { name: "Visual Field Test", category: "Diagnostic", amount: 800, sortOrder: 20 },
    { name: "Corneal Topography", category: "Diagnostic", amount: 1000, sortOrder: 21 },
    { name: "Pachymetry", category: "Diagnostic", amount: 500, sortOrder: 22 },

    // Procedure
    { name: "Phacoemulsification + IOL", category: "Procedure", amount: 25000, sortOrder: 30 },
    { name: "Cataract Surgery (SICS)", category: "Procedure", amount: 12000, sortOrder: 31 },
    { name: "Pterygium Excision", category: "Procedure", amount: 8000, sortOrder: 32 },
    { name: "Chalazion Excision", category: "Procedure", amount: 3000, sortOrder: 33 },
    { name: "Lid Repair", category: "Procedure", amount: 5000, sortOrder: 34 },
    { name: "Syringing & Probing", category: "Procedure", amount: 500, sortOrder: 35 },
    { name: "Intravitreal Injection", category: "Procedure", amount: 15000, sortOrder: 36 },
    { name: "Laser (YAG Capsulotomy)", category: "Procedure", amount: 5000, sortOrder: 37 },
    { name: "Laser (SLT)", category: "Procedure", amount: 8000, sortOrder: 38 },

    // Glasses / Optical
    { name: "Spectacle Prescription", category: "Optical", amount: 0, sortOrder: 40 },
    { name: "Contact Lens Trial", category: "Optical", amount: 200, sortOrder: 41 },

    // Other
    { name: "Medical Certificate", category: "Other", amount: 100, sortOrder: 50 },
    { name: "Record Copy", category: "Other", amount: 50, sortOrder: 51 },
  ]

  for (const svc of services) {
    await db.serviceTemplate.upsert({
      where: { id: `seed-svc-${svc.sortOrder}` },
      update: {},
      create: {
        id: `seed-svc-${svc.sortOrder}`,
        name: svc.name,
        category: svc.category,
        amount: svc.amount,
        sortOrder: svc.sortOrder,
        isActive: true,
        createdBy: admin.id,
      },
    })
  }
  console.log(`✅ ${services.length} service templates created`)

  // ─── Medicine Master ─────────────────────────────────────────────────────────
  const medicines = [
    // Eye Drops
    { name: "Moxifloxacin Eye Drops (0.5%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "7" },
    { name: "Tobramycin Eye Drops (0.3%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "7" },
    { name: "Ofloxacin Eye Drops (0.3%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "7" },
    { name: "Ciprofloxacin Eye Drops (0.3%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "7" },
    { name: "Prednisolone Eye Drops (1%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "14" },
    { name: "Dexamethasone Eye Drops (0.1%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "14" },
    { name: "Timolol Eye Drops (0.5%)", category: "Eye Drop", defaultTiming: "2 times/day", defaultDays: "30" },
    { name: "Latanoprost Eye Drops (0.005%)", category: "Eye Drop", defaultTiming: "Once at bedtime", defaultDays: "30" },
    { name: "Carboxymethylcellulose Eye Drops (0.5%)", category: "Eye Drop", defaultTiming: "As needed", defaultDays: "30" },
    { name: "Ketorolac Eye Drops (0.5%)", category: "Eye Drop", defaultTiming: "4 times/day", defaultDays: "7" },
    { name: "Atropine Eye Drops (1%)", category: "Eye Drop", defaultTiming: "2 times/day", defaultDays: "7" },
    { name: "Cyclopentolate Eye Drops (1%)", category: "Eye Drop", defaultTiming: "As directed", defaultDays: "3" },
    { name: "Betaxolol Eye Drops (0.25%)", category: "Eye Drop", defaultTiming: "2 times/day", defaultDays: "30" },
    { name: "Dorzolamide + Timolol Eye Drops", category: "Eye Drop", defaultTiming: "2 times/day", defaultDays: "30" },
    { name: "Nepafenac Eye Drops (0.1%)", category: "Eye Drop", defaultTiming: "3 times/day", defaultDays: "14" },

    // Eye Ointments
    { name: "Erythromycin Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Tobramycin Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Chloramphenicol Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Hydrocortisone Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "5" },

    // Tablets
    { name: "Paracetamol 500mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "5" },
    { name: "Ibuprofen 400mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "5" },
    { name: "Amoxicillin 500mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "7" },
    { name: "Ciprofloxacin 500mg", category: "Tablet", defaultTiming: "2 times/day", defaultDays: "7" },
    { name: "Metronidazole 400mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "5" },
    { name: "Methylprednisolone 4mg", category: "Tablet", defaultTiming: "As directed", defaultDays: "7" },
    { name: "Acetazolamide 250mg", category: "Tablet", defaultTiming: "4 times/day", defaultDays: "3" },
    { name: "Vitamin C 500mg", category: "Tablet", defaultTiming: "Once daily", defaultDays: "30" },
    { name: "Vitamin E 400IU", category: "Tablet", defaultTiming: "Once daily", defaultDays: "30" },
    { name: "Lutein + Zeaxanthin", category: "Tablet", defaultTiming: "Once daily", defaultDays: "90" },

    // Injections
    { name: "Bevacizumab (Avastin) 1.25mg - Intravitreal", category: "Injection", defaultTiming: "Single dose", defaultDays: "1" },
    { name: "Ranibizumab (Lucentis) - Intravitreal", category: "Injection", defaultTiming: "Single dose", defaultDays: "1" },
  ]

  for (let i = 0; i < medicines.length; i++) {
    const m = medicines[i]
    await db.medicineMaster.upsert({
      where: { name: m.name },
      update: {},
      create: {
        name: m.name,
        category: m.category,
        defaultTiming: m.defaultTiming,
        defaultDays: m.defaultDays,
        isActive: true,
        sortOrder: i + 1,
        createdBy: admin.id,
      },
    })
  }
  console.log(`✅ ${medicines.length} medicines created`)

  // ─── Investigation Master ────────────────────────────────────────────────────
  const investigations = [
    { name: "Complete Blood Picture (CBP)", category: "Lab Test" },
    { name: "Random Blood Sugar (RBS)", category: "Lab Test" },
    { name: "Fasting Blood Sugar (FBS)", category: "Lab Test" },
    { name: "HbA1c", category: "Lab Test" },
    { name: "Blood Pressure", category: "General" },
    { name: "HIV Test", category: "Lab Test" },
    { name: "HBsAg Test", category: "Lab Test" },
    { name: "ECG", category: "General" },
    { name: "Chest X-Ray", category: "Imaging" },
    { name: "OCT Macula", category: "Eye Test" },
    { name: "OCT Optic Nerve Head", category: "Eye Test" },
    { name: "Visual Field (Perimetry)", category: "Eye Test" },
    { name: "Corneal Topography", category: "Eye Test" },
    { name: "A-Scan Biometry", category: "Eye Test" },
    { name: "B-Scan Ultrasonography", category: "Eye Test" },
    { name: "Fundus Photography", category: "Eye Test" },
    { name: "Fluorescein Angiography (FFA)", category: "Eye Test" },
    { name: "ERG (Electroretinogram)", category: "Eye Test" },
  ]

  for (let i = 0; i < investigations.length; i++) {
    const inv = investigations[i]
    await db.investigationMaster.upsert({
      where: { name: inv.name },
      update: {},
      create: {
        name: inv.name,
        category: inv.category,
        isActive: true,
        sortOrder: i + 1,
        createdBy: admin.id,
      },
    })
  }
  console.log(`✅ ${investigations.length} investigations created`)

  // ─── Dropdown Options ────────────────────────────────────────────────────────
  const dropdownData: { fieldName: string; values: string[] }[] = [
    {
      fieldName: "presentComplaint",
      values: [
        "Diminution of vision",
        "Pain in eye",
        "Redness of eye",
        "Watering from eye",
        "Double vision",
        "Foreign body sensation",
        "Glare and halos",
        "Night blindness",
        "Headache",
        "Discharge from eye",
        "Itching in eye",
        "Swelling of eyelid",
        "Drooping of eyelid",
        "Flashes of light",
        "Floaters in vision",
      ],
    },
    {
      fieldName: "diagnosis",
      values: [
        "Immature senile cataract",
        "Mature senile cataract",
        "Nuclear sclerosis",
        "Posterior subcapsular cataract",
        "Primary open angle glaucoma",
        "Narrow angle glaucoma",
        "Angle closure glaucoma",
        "Diabetic macular edema",
        "Proliferative diabetic retinopathy",
        "Non-proliferative diabetic retinopathy",
        "Age-related macular degeneration (dry)",
        "Age-related macular degeneration (wet)",
        "Rhegmatogenous retinal detachment",
        "Pterygium",
        "Conjunctivitis (viral)",
        "Conjunctivitis (bacterial)",
        "Corneal ulcer",
        "Keratoconus",
        "Anterior uveitis",
        "Optic neuritis",
        "Central retinal artery occlusion",
        "Central retinal vein occlusion",
        "Chalazion",
        "Stye (hordeolum)",
        "Dacryocystitis",
        "Blepharitis",
        "Amblyopia",
        "Squint (esotropia)",
        "Squint (exotropia)",
        "Myopia",
        "Hypermetropia",
        "Astigmatism",
        "Presbyopia",
      ],
    },
    {
      fieldName: "previousHistory",
      values: [
        "No significant history",
        "Hypertension on medication",
        "Diabetes mellitus (Type 2)",
        "Previous cataract surgery - RE",
        "Previous cataract surgery - LE",
        "Previous glaucoma surgery",
        "Previous LASIK",
        "Previous corneal transplant",
        "Family history of glaucoma",
        "Thyroid disorder",
        "Drug allergy",
      ],
    },
  ]

  let optCount = 0
  for (const { fieldName, values } of dropdownData) {
    for (const value of values) {
      await db.dropdownOption.upsert({
        where: { fieldName_value: { fieldName, value } },
        update: {},
        create: { fieldName, value, createdBy: admin.id },
      })
      optCount++
    }
  }
  console.log(`✅ ${optCount} dropdown options created`)

  // ─── Predefined Templates ────────────────────────────────────────────────────
  const templates = [
    {
      code: "CAT01",
      name: "Cataract - Standard",
      presentComplaint: "Diminution of vision",
      provisionalDiagnosis: "Immature senile cataract",
      medicines: JSON.stringify([
        { name: "Moxifloxacin Eye Drops (0.5%)", days: "7", timing: "4 times/day" },
        { name: "Prednisolone Eye Drops (1%)", days: "14", timing: "4 times/day" },
        { name: "Ketorolac Eye Drops (0.5%)", days: "7", timing: "4 times/day" },
      ]),
      investigations: JSON.stringify(["A-Scan Biometry", "CBP", "RBS", "HbA1c", "HIV Test", "HBsAg Test"]),
    },
    {
      code: "GLAUC01",
      name: "Glaucoma - Initial",
      presentComplaint: "Elevated IOP found on routine check",
      provisionalDiagnosis: "Primary open angle glaucoma",
      medicines: JSON.stringify([
        { name: "Timolol Eye Drops (0.5%)", days: "30", timing: "2 times/day" },
        { name: "Latanoprost Eye Drops (0.005%)", days: "30", timing: "Once at bedtime" },
      ]),
      investigations: JSON.stringify(["Visual Field (Perimetry)", "OCT Optic Nerve Head", "Corneal Topography"]),
    },
    {
      code: "CONJ01",
      name: "Conjunctivitis - Bacterial",
      presentComplaint: "Redness and discharge from eye",
      provisionalDiagnosis: "Conjunctivitis (bacterial)",
      medicines: JSON.stringify([
        { name: "Tobramycin Eye Drops (0.3%)", days: "7", timing: "4 times/day" },
        { name: "Erythromycin Eye Ointment", days: "7", timing: "Bedtime" },
      ]),
      investigations: JSON.stringify([]),
    },
  ]

  for (const tmpl of templates) {
    await db.predefinedTemplate.upsert({
      where: { code: tmpl.code },
      update: {},
      create: {
        code: tmpl.code,
        name: tmpl.name,
        presentComplaint: tmpl.presentComplaint,
        provisionalDiagnosis: tmpl.provisionalDiagnosis,
        medicines: tmpl.medicines,
        investigations: tmpl.investigations,
        isActive: true,
        createdBy: admin.id,
      },
    })
  }
  console.log(`✅ ${templates.length} predefined templates created`)

  // ─── Labs & Lab Investigation Mappings ───────────────────────────────────────
  const labsData = [
    { name: "Pathology Lab", description: "Blood tests and lab investigations", location: "Ground Floor, Room 5" },
    { name: "Radiology", description: "Imaging and scans", location: "First Floor, Room 12" },
    { name: "Eye Diagnostics", description: "Ophthalmic diagnostic tests", location: "Ground Floor, Room 3" },
  ]

  const createdLabs: Record<string, string> = {}
  for (const labData of labsData) {
    const lab = await db.lab.upsert({
      where: { name: labData.name },
      update: {},
      create: labData,
    })
    createdLabs[labData.name] = lab.id
  }
  console.log(`✅ ${labsData.length} labs created`)

  // Map investigations to labs with pricing
  const allInvestigations = await db.investigationMaster.findMany({ where: { isActive: true } })
  const invMap = new Map(allInvestigations.map(i => [i.name, i.id]))

  const labInvestigationMappings: { labName: string; invName: string; amount: number; isDefault: boolean }[] = [
    // Pathology Lab
    { labName: "Pathology Lab", invName: "Complete Blood Picture (CBP)", amount: 500, isDefault: true },
    { labName: "Pathology Lab", invName: "Random Blood Sugar (RBS)", amount: 200, isDefault: true },
    { labName: "Pathology Lab", invName: "Fasting Blood Sugar (FBS)", amount: 250, isDefault: true },
    { labName: "Pathology Lab", invName: "HbA1c", amount: 800, isDefault: true },
    { labName: "Pathology Lab", invName: "HIV Test", amount: 500, isDefault: true },
    { labName: "Pathology Lab", invName: "HBsAg Test", amount: 400, isDefault: true },
    // Radiology
    { labName: "Radiology", invName: "Chest X-Ray", amount: 500, isDefault: true },
    { labName: "Radiology", invName: "ECG", amount: 300, isDefault: true },
    { labName: "Radiology", invName: "B-Scan Ultrasonography", amount: 600, isDefault: true },
    { labName: "Radiology", invName: "A-Scan Biometry", amount: 500, isDefault: true },
    // Eye Diagnostics
    { labName: "Eye Diagnostics", invName: "OCT Macula", amount: 1200, isDefault: true },
    { labName: "Eye Diagnostics", invName: "OCT Optic Nerve Head", amount: 1200, isDefault: true },
    { labName: "Eye Diagnostics", invName: "Visual Field (Perimetry)", amount: 1000, isDefault: true },
    { labName: "Eye Diagnostics", invName: "Corneal Topography", amount: 800, isDefault: true },
    { labName: "Eye Diagnostics", invName: "Fundus Photography", amount: 400, isDefault: true },
    { labName: "Eye Diagnostics", invName: "Fluorescein Angiography (FFA)", amount: 2000, isDefault: true },
    { labName: "Eye Diagnostics", invName: "ERG (Electroretinogram)", amount: 1500, isDefault: true },
  ]

  let mappingCount = 0
  for (const mapping of labInvestigationMappings) {
    const labId = createdLabs[mapping.labName]
    const investigationId = invMap.get(mapping.invName)
    if (!labId || !investigationId) continue

    await db.labInvestigation.upsert({
      where: { labId_investigationId: { labId, investigationId } },
      update: {},
      create: {
        labId,
        investigationId,
        amount: mapping.amount,
        isDefault: mapping.isDefault,
        isActive: true,
      },
    })
    mappingCount++
  }
  console.log(`✅ ${mappingCount} lab-investigation mappings created`)

  console.log("\n🎉 Seeding complete!\n")
  console.log("Login credentials:")
  console.log("  Admin:       admin@docsile.com     / admin123")
  console.log("  Doctor:      doctor@docsile.com    / doctor123")
  console.log("  Reception:   reception@docsile.com / reception123")
}

main()
  .catch(e => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
