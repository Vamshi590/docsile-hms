import pg from "pg"
import bcrypt from "bcryptjs"

const { Client } = pg

const client = new Client({
  host: "db.iitfqofabjqejzkvyvuz.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "D@csile2024",
  ssl: { rejectUnauthorized: false },
})

function id() {
  return crypto.randomUUID()
}

async function hash(password) {
  return bcrypt.hash(password, 10)
}

async function main() {
  await client.connect()
  console.log("Connected to Supabase PostgreSQL\n")

  // ═══════════════════════════════════════════════════════
  // 1. USERS (with bcrypt-hashed passwords)
  // ═══════════════════════════════════════════════════════
  const adminId = id()
  const doctorId = id()
  const doctor2Id = id()
  const receptionId = id()
  const optometristId = id()
  const nurseId = id()

  const users = [
    {
      id: adminId,
      email: "admin@docsile.com",
      passwordHash: await hash("admin123"),
      fullName: "Dr. Vamshidhar",
      phone: "9999999999",
      role: "ADMIN",
      department: "Administration",
      designation: "Hospital Administrator",
      employeeId: "EMP001",
    },
    {
      id: doctorId,
      email: "doctor@docsile.com",
      passwordHash: await hash("doctor123"),
      fullName: "Dr. Rajesh Kumar",
      phone: "9888888888",
      role: "DOCTOR",
      department: "Ophthalmology",
      designation: "Senior Ophthalmologist",
      employeeId: "EMP002",
      qualifications: "MBBS, MS (Ophthalmology)",
    },
    {
      id: doctor2Id,
      email: "doctor2@docsile.com",
      passwordHash: await hash("doctor123"),
      fullName: "Dr. Sneha Reddy",
      phone: "9888877777",
      role: "DOCTOR",
      department: "Ophthalmology",
      designation: "Junior Ophthalmologist",
      employeeId: "EMP003",
      qualifications: "MBBS, DNB (Ophthalmology)",
    },
    {
      id: receptionId,
      email: "reception@docsile.com",
      passwordHash: await hash("reception123"),
      fullName: "Priya Sharma",
      phone: "9777777777",
      role: "RECEPTIONIST",
      department: null,
      designation: "Front Desk",
      employeeId: "EMP004",
    },
    {
      id: optometristId,
      email: "optometrist@docsile.com",
      passwordHash: await hash("optom123"),
      fullName: "Arjun Patel",
      phone: "9666666666",
      role: "OPTOMETRIST",
      department: "Optical",
      designation: "Senior Optometrist",
      employeeId: "EMP005",
      qualifications: "B.Sc Optometry",
    },
    {
      id: nurseId,
      email: "nurse@docsile.com",
      passwordHash: await hash("nurse123"),
      fullName: "Kavitha Devi",
      phone: "9555555555",
      role: "NURSE",
      department: "Nursing",
      designation: "Staff Nurse",
      employeeId: "EMP006",
    },
  ]

  for (const u of users) {
    await client.query(
      `INSERT INTO "User" ("id","email","passwordHash","fullName","phone","role","department","designation","employeeId","qualifications","isActive")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
       ON CONFLICT ("email") DO NOTHING`,
      [u.id, u.email, u.passwordHash, u.fullName, u.phone, u.role, u.department, u.designation, u.employeeId, u.qualifications || null]
    )
  }
  console.log(`✅ ${users.length} users created`)

  // ═══════════════════════════════════════════════════════
  // 2. ROLES (with permissions)
  // ═══════════════════════════════════════════════════════
  const allPerms = [
    "dashboard:view","patients:view","patients:create","patients:edit","patients:delete",
    "workup:view","workup:create","workup:edit","doctor:view","doctor:consult",
    "labs:view","labs:create","labs:edit","labs:config","pharmacy:view","pharmacy:create",
    "pharmacy:edit","pharmacy:manage_stock","pharmacy:purchase_orders",
    "optical:view","optical:create","optical:edit","optical:manage_stock",
    "inpatients:view","inpatients:create","inpatients:edit","inpatients:discharge","inpatients:delete",
    "insurance:view","insurance:create","insurance:edit","dues:view","dues:edit",
    "expenses:view","expenses:create","expenses:edit","expenses:delete",
    "reports:view","licenses:view","licenses:create","licenses:edit","licenses:delete",
    "settings:view","settings:edit","staff:view","staff:create","staff:edit","staff:deactivate","staff:manage_roles",
    "data:export"
  ]

  const roles = [
    { name: "ADMIN", displayName: "Administrator", permissions: JSON.stringify(allPerms), isSystem: true },
    { name: "DOCTOR", displayName: "Doctor", permissions: JSON.stringify([
      "dashboard:view","patients:view","patients:edit","workup:view","doctor:view","doctor:consult",
      "labs:view","pharmacy:view","inpatients:view","inpatients:edit","insurance:view","dues:view","reports:view"
    ]), isSystem: true },
    { name: "RECEPTIONIST", displayName: "Receptionist", permissions: JSON.stringify([
      "dashboard:view","patients:view","patients:create","patients:edit","workup:view","workup:create",
      "doctor:view","labs:view","labs:create","pharmacy:view","pharmacy:create","optical:view","optical:create",
      "inpatients:view","inpatients:create","insurance:view","insurance:create","dues:view","dues:edit",
      "expenses:view","expenses:create"
    ]), isSystem: true },
    { name: "OPTOMETRIST", displayName: "Optometrist", permissions: JSON.stringify([
      "dashboard:view","patients:view","workup:view","workup:create","workup:edit","doctor:view",
      "optical:view","optical:create","optical:edit"
    ]), isSystem: true },
    { name: "NURSE", displayName: "Nurse", permissions: JSON.stringify([
      "dashboard:view","patients:view","patients:edit","workup:view","workup:create","doctor:view",
      "inpatients:view","inpatients:edit","dues:view"
    ]), isSystem: true },
  ]

  for (const r of roles) {
    await client.query(
      `INSERT INTO "Role" ("id","name","displayName","permissions","isSystem","isActive")
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT ("name") DO NOTHING`,
      [id(), r.name, r.displayName, r.permissions, r.isSystem]
    )
  }
  console.log(`✅ ${roles.length} roles created`)

  // ═══════════════════════════════════════════════════════
  // 3. HOSPITAL PROFILE
  // ═══════════════════════════════════════════════════════
  await client.query(
    `INSERT INTO "HospitalProfile" ("id","name","displayName","address","phone","email","website","registrationNo","gstin","settings")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("id") DO NOTHING`,
    [
      "main",
      "Sri Harsha Eye Hospital",
      "Sri Harsha Eye Care",
      JSON.stringify({ line1: "123 Medical Lane", line2: "Sector 5", city: "Hyderabad", state: "Telangana", pincode: "500001" }),
      "040-12345678",
      "info@sriharshaeye.com",
      "www.sriharshaeye.com",
      "MCI-2024-001",
      "36AAACD1234F1ZA",
      JSON.stringify({ patientIdPrefix: "OP", invoicePrefix: "INV", currency: "INR", currencySymbol: "₹" }),
    ]
  )
  console.log("✅ Hospital profile created")

  // ═══════════════════════════════════════════════════════
  // 4. SERVICE TEMPLATES
  // ═══════════════════════════════════════════════════════
  const services = [
    { name: "General Consultation", category: "Consultation", amount: 300, sortOrder: 1 },
    { name: "Senior Consultation", category: "Consultation", amount: 500, sortOrder: 2 },
    { name: "Follow-up Consultation", category: "Consultation", amount: 150, sortOrder: 3 },
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
    { name: "Phacoemulsification + IOL", category: "Procedure", amount: 25000, sortOrder: 30 },
    { name: "Cataract Surgery (SICS)", category: "Procedure", amount: 12000, sortOrder: 31 },
    { name: "Pterygium Excision", category: "Procedure", amount: 8000, sortOrder: 32 },
    { name: "Chalazion Excision", category: "Procedure", amount: 3000, sortOrder: 33 },
    { name: "Lid Repair", category: "Procedure", amount: 5000, sortOrder: 34 },
    { name: "Syringing & Probing", category: "Procedure", amount: 500, sortOrder: 35 },
    { name: "Intravitreal Injection", category: "Procedure", amount: 15000, sortOrder: 36 },
    { name: "Laser (YAG Capsulotomy)", category: "Procedure", amount: 5000, sortOrder: 37 },
    { name: "Laser (SLT)", category: "Procedure", amount: 8000, sortOrder: 38 },
    { name: "Spectacle Prescription", category: "Optical", amount: 0, sortOrder: 40 },
    { name: "Contact Lens Trial", category: "Optical", amount: 200, sortOrder: 41 },
    { name: "Medical Certificate", category: "Other", amount: 100, sortOrder: 50 },
    { name: "Record Copy", category: "Other", amount: 50, sortOrder: 51 },
  ]

  for (const s of services) {
    await client.query(
      `INSERT INTO "ServiceTemplate" ("id","name","category","amount","sortOrder","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,true,$6)
       ON CONFLICT DO NOTHING`,
      [id(), s.name, s.category, s.amount, s.sortOrder, adminId]
    )
  }
  console.log(`✅ ${services.length} service templates created`)

  // ═══════════════════════════════════════════════════════
  // 5. MEDICINE MASTER
  // ═══════════════════════════════════════════════════════
  const medicines = [
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
    { name: "Dorzolamide + Timolol Eye Drops", category: "Eye Drop", defaultTiming: "2 times/day", defaultDays: "30" },
    { name: "Nepafenac Eye Drops (0.1%)", category: "Eye Drop", defaultTiming: "3 times/day", defaultDays: "14" },
    { name: "Erythromycin Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Tobramycin Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Chloramphenicol Eye Ointment", category: "Ointment", defaultTiming: "Bedtime", defaultDays: "7" },
    { name: "Paracetamol 500mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "5" },
    { name: "Ibuprofen 400mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "5" },
    { name: "Amoxicillin 500mg", category: "Tablet", defaultTiming: "3 times/day", defaultDays: "7" },
    { name: "Ciprofloxacin 500mg", category: "Tablet", defaultTiming: "2 times/day", defaultDays: "7" },
    { name: "Acetazolamide 250mg", category: "Tablet", defaultTiming: "4 times/day", defaultDays: "3" },
    { name: "Vitamin C 500mg", category: "Tablet", defaultTiming: "Once daily", defaultDays: "30" },
    { name: "Lutein + Zeaxanthin", category: "Tablet", defaultTiming: "Once daily", defaultDays: "90" },
    { name: "Bevacizumab (Avastin) 1.25mg", category: "Injection", defaultTiming: "Single dose", defaultDays: "1" },
    { name: "Ranibizumab (Lucentis)", category: "Injection", defaultTiming: "Single dose", defaultDays: "1" },
  ]

  for (let i = 0; i < medicines.length; i++) {
    const m = medicines[i]
    await client.query(
      `INSERT INTO "MedicineMaster" ("id","name","category","defaultTiming","defaultDays","isActive","sortOrder","createdBy")
       VALUES ($1,$2,$3,$4,$5,true,$6,$7)
       ON CONFLICT ("name") DO NOTHING`,
      [id(), m.name, m.category, m.defaultTiming, m.defaultDays, i + 1, adminId]
    )
  }
  console.log(`✅ ${medicines.length} medicines created`)

  // ═══════════════════════════════════════════════════════
  // 6. INVESTIGATION MASTER
  // ═══════════════════════════════════════════════════════
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
    await client.query(
      `INSERT INTO "InvestigationMaster" ("id","name","category","isActive","sortOrder","createdBy")
       VALUES ($1,$2,$3,true,$4,$5)
       ON CONFLICT ("name") DO NOTHING`,
      [id(), inv.name, inv.category, i + 1, adminId]
    )
  }
  console.log(`✅ ${investigations.length} investigations created`)

  // ═══════════════════════════════════════════════════════
  // 7. DROPDOWN OPTIONS
  // ═══════════════════════════════════════════════════════
  const dropdowns = {
    presentComplaint: [
      "Diminution of vision", "Pain in eye", "Redness of eye", "Watering from eye",
      "Double vision", "Foreign body sensation", "Glare and halos", "Night blindness",
      "Headache", "Discharge from eye", "Itching in eye", "Swelling of eyelid",
      "Drooping of eyelid", "Flashes of light", "Floaters in vision",
    ],
    diagnosis: [
      "Immature senile cataract", "Mature senile cataract", "Nuclear sclerosis",
      "Primary open angle glaucoma", "Narrow angle glaucoma", "Diabetic macular edema",
      "Non-proliferative diabetic retinopathy", "Pterygium", "Conjunctivitis (viral)",
      "Conjunctivitis (bacterial)", "Corneal ulcer", "Keratoconus", "Anterior uveitis",
      "Chalazion", "Stye (hordeolum)", "Dacryocystitis", "Blepharitis",
      "Myopia", "Hypermetropia", "Astigmatism", "Presbyopia",
    ],
    previousHistory: [
      "No significant history", "Hypertension on medication", "Diabetes mellitus (Type 2)",
      "Previous cataract surgery - RE", "Previous cataract surgery - LE",
      "Previous glaucoma surgery", "Family history of glaucoma", "Drug allergy",
    ],
  }

  let optCount = 0
  for (const [fieldName, values] of Object.entries(dropdowns)) {
    for (const value of values) {
      await client.query(
        `INSERT INTO "DropdownOption" ("id","fieldName","value","createdBy")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("fieldName","value") DO NOTHING`,
        [id(), fieldName, value, adminId]
      )
      optCount++
    }
  }
  console.log(`✅ ${optCount} dropdown options created`)

  // ═══════════════════════════════════════════════════════
  // 8. PREDEFINED TEMPLATES
  // ═══════════════════════════════════════════════════════
  const templates = [
    {
      code: "CAT01", name: "Cataract - Standard",
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
      code: "GLAUC01", name: "Glaucoma - Initial",
      presentComplaint: "Elevated IOP found on routine check",
      provisionalDiagnosis: "Primary open angle glaucoma",
      medicines: JSON.stringify([
        { name: "Timolol Eye Drops (0.5%)", days: "30", timing: "2 times/day" },
        { name: "Latanoprost Eye Drops (0.005%)", days: "30", timing: "Once at bedtime" },
      ]),
      investigations: JSON.stringify(["Visual Field (Perimetry)", "OCT Optic Nerve Head", "Corneal Topography"]),
    },
    {
      code: "CONJ01", name: "Conjunctivitis - Bacterial",
      presentComplaint: "Redness and discharge from eye",
      provisionalDiagnosis: "Conjunctivitis (bacterial)",
      medicines: JSON.stringify([
        { name: "Tobramycin Eye Drops (0.3%)", days: "7", timing: "4 times/day" },
        { name: "Erythromycin Eye Ointment", days: "7", timing: "Bedtime" },
      ]),
      investigations: JSON.stringify([]),
    },
  ]

  for (const t of templates) {
    await client.query(
      `INSERT INTO "PredefinedTemplate" ("id","code","name","presentComplaint","provisionalDiagnosis","medicines","investigations","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
       ON CONFLICT ("code") DO NOTHING`,
      [id(), t.code, t.name, t.presentComplaint, t.provisionalDiagnosis, t.medicines, t.investigations, adminId]
    )
  }
  console.log(`✅ ${templates.length} predefined templates created`)

  // ═══════════════════════════════════════════════════════
  // 9. LABS + LAB INVESTIGATION MAPPINGS
  // ═══════════════════════════════════════════════════════
  const labIds = {}
  const labsData = [
    { name: "Pathology Lab", description: "Blood tests and lab investigations", location: "Ground Floor, Room 5" },
    { name: "Radiology", description: "Imaging and scans", location: "First Floor, Room 12" },
    { name: "Eye Diagnostics", description: "Ophthalmic diagnostic tests", location: "Ground Floor, Room 3" },
  ]
  for (const lab of labsData) {
    const labId = id()
    labIds[lab.name] = labId
    await client.query(
      `INSERT INTO "Lab" ("id","name","description","location","isActive") VALUES ($1,$2,$3,$4,true) ON CONFLICT ("name") DO NOTHING`,
      [labId, lab.name, lab.description, lab.location]
    )
  }
  console.log(`✅ ${labsData.length} labs created`)

  // Fetch investigation IDs
  const { rows: invRows } = await client.query(`SELECT "id","name" FROM "InvestigationMaster"`)
  const invMap = Object.fromEntries(invRows.map(r => [r.name, r.id]))
  // Fetch lab IDs (in case they already existed)
  const { rows: labRows } = await client.query(`SELECT "id","name" FROM "Lab"`)
  for (const r of labRows) labIds[r.name] = r.id

  const labMappings = [
    { lab: "Pathology Lab", inv: "Complete Blood Picture (CBP)", amount: 500 },
    { lab: "Pathology Lab", inv: "Random Blood Sugar (RBS)", amount: 200 },
    { lab: "Pathology Lab", inv: "Fasting Blood Sugar (FBS)", amount: 250 },
    { lab: "Pathology Lab", inv: "HbA1c", amount: 800 },
    { lab: "Pathology Lab", inv: "HIV Test", amount: 500 },
    { lab: "Pathology Lab", inv: "HBsAg Test", amount: 400 },
    { lab: "Radiology", inv: "Chest X-Ray", amount: 500 },
    { lab: "Radiology", inv: "ECG", amount: 300 },
    { lab: "Radiology", inv: "B-Scan Ultrasonography", amount: 600 },
    { lab: "Radiology", inv: "A-Scan Biometry", amount: 500 },
    { lab: "Eye Diagnostics", inv: "OCT Macula", amount: 1200 },
    { lab: "Eye Diagnostics", inv: "OCT Optic Nerve Head", amount: 1200 },
    { lab: "Eye Diagnostics", inv: "Visual Field (Perimetry)", amount: 1000 },
    { lab: "Eye Diagnostics", inv: "Corneal Topography", amount: 800 },
    { lab: "Eye Diagnostics", inv: "Fundus Photography", amount: 400 },
    { lab: "Eye Diagnostics", inv: "Fluorescein Angiography (FFA)", amount: 2000 },
    { lab: "Eye Diagnostics", inv: "ERG (Electroretinogram)", amount: 1500 },
  ]

  let mappingCount = 0
  for (const m of labMappings) {
    const labId = labIds[m.lab]
    const investigationId = invMap[m.inv]
    if (!labId || !investigationId) continue
    await client.query(
      `INSERT INTO "LabInvestigation" ("id","labId","investigationId","amount","isDefault","isActive")
       VALUES ($1,$2,$3,$4,true,true)
       ON CONFLICT ("labId","investigationId") DO NOTHING`,
      [id(), labId, investigationId, m.amount]
    )
    mappingCount++
  }
  console.log(`✅ ${mappingCount} lab-investigation mappings created`)

  // ═══════════════════════════════════════════════════════
  // 10. EXPENSE CATEGORIES
  // ═══════════════════════════════════════════════════════
  const expCategories = [
    { name: "Salaries", color: "#2563EB" },
    { name: "Rent & Utilities", color: "#7C3AED" },
    { name: "Medical Supplies", color: "#059669" },
    { name: "Equipment Maintenance", color: "#D97706" },
    { name: "Office Supplies", color: "#6B7280" },
    { name: "Marketing", color: "#EC4899" },
    { name: "Insurance Premium", color: "#0891B2" },
    { name: "Miscellaneous", color: "#9CA3AF" },
  ]

  const expCatIds = {}
  for (let i = 0; i < expCategories.length; i++) {
    const c = expCategories[i]
    const catId = id()
    expCatIds[c.name] = catId
    await client.query(
      `INSERT INTO "ExpenseCategory" ("id","name","color","sortOrder","isActive","createdBy") VALUES ($1,$2,$3,$4,true,$5)
       ON CONFLICT ("name") DO NOTHING`,
      [catId, c.name, c.color, i + 1, adminId]
    )
  }
  // Re-fetch IDs in case of conflicts
  const { rows: catRows } = await client.query(`SELECT "id","name" FROM "ExpenseCategory"`)
  for (const r of catRows) expCatIds[r.name] = r.id
  console.log(`✅ ${expCategories.length} expense categories created`)

  // ═══════════════════════════════════════════════════════
  // 11. SAMPLE EXPENSES
  // ═══════════════════════════════════════════════════════
  const sampleExpenses = [
    { title: "Staff salaries - March", categoryName: "Salaries", amount: 250000, daysAgo: 5, paymentMode: "BANK_TRANSFER" },
    { title: "Electricity bill", categoryName: "Rent & Utilities", amount: 15000, daysAgo: 3, paymentMode: "BANK_TRANSFER" },
    { title: "Eye drops stock", categoryName: "Medical Supplies", amount: 8500, daysAgo: 2, paymentMode: "CASH" },
    { title: "AC maintenance", categoryName: "Equipment Maintenance", amount: 3500, daysAgo: 7, paymentMode: "CASH" },
    { title: "Printer cartridges", categoryName: "Office Supplies", amount: 1200, daysAgo: 1, paymentMode: "UPI" },
  ]

  for (const e of sampleExpenses) {
    const d = new Date()
    d.setDate(d.getDate() - e.daysAgo)
    await client.query(
      `INSERT INTO "Expense" ("id","title","categoryId","amount","date","paymentMode","createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id(), e.title, expCatIds[e.categoryName], e.amount, d.toISOString(), e.paymentMode, adminId]
    )
  }
  console.log(`✅ ${sampleExpenses.length} sample expenses created`)

  // ═══════════════════════════════════════════════════════
  // 12. SAMPLE PATIENTS (today's date for testing)
  // ═══════════════════════════════════════════════════════
  const today = new Date()
  const patients = [
    { pid: "OP0001", firstName: "Ramesh", lastName: "Babu", age: 62, gender: "MALE", phone: "9876543210", doctorName: "Dr. Rajesh Kumar", status: "COMPLETED", department: "Ophthalmology", minsAgo: 180 },
    { pid: "OP0002", firstName: "Lakshmi", lastName: "Devi", age: 55, gender: "FEMALE", phone: "9876543211", doctorName: "Dr. Rajesh Kumar", status: "IN_CONSULTATION", department: "Ophthalmology", minsAgo: 120 },
    { pid: "OP0003", firstName: "Suresh", lastName: "Kumar", age: 45, gender: "MALE", phone: "9876543212", doctorName: "Dr. Sneha Reddy", status: "WAITING", department: "Ophthalmology", minsAgo: 90 },
    { pid: "OP0004", firstName: "Anitha", lastName: "Reddy", age: 38, gender: "FEMALE", phone: "9876543213", doctorName: "Dr. Sneha Reddy", status: "WAITING", department: "Ophthalmology", minsAgo: 60 },
    { pid: "OP0005", firstName: "Venkatesh", lastName: null, age: 70, gender: "MALE", phone: "9876543214", doctorName: "Dr. Rajesh Kumar", status: "REGISTERED", department: "Ophthalmology", minsAgo: 30, guardianName: "Srinivas (Son)" },
    { pid: "OP0006", firstName: "Padma", lastName: "Kumari", age: 50, gender: "FEMALE", phone: "9876543215", doctorName: "Dr. Rajesh Kumar", status: "COMPLETED", department: "Ophthalmology", minsAgo: 240 },
    { pid: "OP0007", firstName: "Ravi", lastName: "Teja", age: 28, gender: "MALE", phone: "9876543216", doctorName: "Dr. Sneha Reddy", status: "REGISTERED", department: "Ophthalmology", minsAgo: 15 },
    { pid: "OP0008", firstName: "Shalini", lastName: "Prasad", age: 42, gender: "FEMALE", phone: "9876543217", doctorName: "Dr. Rajesh Kumar", status: "COMPLETED", department: "Ophthalmology", minsAgo: 300 },
  ]

  const patientDbIds = {}
  for (const p of patients) {
    const pId = id()
    patientDbIds[p.pid] = pId
    const created = new Date(today.getTime() - p.minsAgo * 60000)
    await client.query(
      `INSERT INTO "Patient" ("id","patientId","firstName","lastName","age","gender","phone","doctorName","department","status","patientType","appointmentDate","guardianName","createdById","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPD',$11,$12,$13,$14)
       ON CONFLICT ("patientId") DO NOTHING`,
      [pId, p.pid, p.firstName, p.lastName, p.age, p.gender, p.phone, p.doctorName, p.department, p.status, today.toISOString(), p.guardianName || null, receptionId, created.toISOString()]
    )
  }
  console.log(`✅ ${patients.length} sample patients created`)

  // ═══════════════════════════════════════════════════════
  // 13. SAMPLE PRESCRIPTIONS (for completed patients)
  // ═══════════════════════════════════════════════════════
  const prescriptions = [
    {
      patientPid: "OP0001",
      prescriptionNumber: "INV-0001",
      doctorIdRef: doctorId,
      doctorName: "Dr. Rajesh Kumar",
      presentComplaint: "Diminution of vision in right eye since 6 months",
      diagnosis: "Immature senile cataract - RE",
      medicines: JSON.stringify([
        { name: "Carboxymethylcellulose Eye Drops (0.5%)", days: "30", timing: "As needed" },
      ]),
      items: [
        { description: "Senior Consultation", category: "Consultation", unitPrice: 500, amount: 500 },
        { description: "Slit Lamp Examination", category: "Diagnostic", unitPrice: 150, amount: 150 },
        { description: "IOP (Tonometry)", category: "Diagnostic", unitPrice: 100, amount: 100 },
      ],
      total: 750, amountPaid: 750, balanceDue: 0, status: "COMPLETED",
    },
    {
      patientPid: "OP0006",
      prescriptionNumber: "INV-0002",
      doctorIdRef: doctorId,
      doctorName: "Dr. Rajesh Kumar",
      presentComplaint: "Redness and watering from left eye since 3 days",
      diagnosis: "Conjunctivitis (bacterial) - LE",
      medicines: JSON.stringify([
        { name: "Tobramycin Eye Drops (0.3%)", days: "7", timing: "4 times/day" },
        { name: "Erythromycin Eye Ointment", days: "7", timing: "Bedtime" },
      ]),
      items: [
        { description: "General Consultation", category: "Consultation", unitPrice: 300, amount: 300 },
        { description: "Slit Lamp Examination", category: "Diagnostic", unitPrice: 150, amount: 150 },
      ],
      total: 450, amountPaid: 450, balanceDue: 0, status: "COMPLETED",
    },
    {
      patientPid: "OP0008",
      prescriptionNumber: "INV-0003",
      doctorIdRef: doctorId,
      doctorName: "Dr. Rajesh Kumar",
      presentComplaint: "Routine glaucoma check-up",
      diagnosis: "Primary open angle glaucoma - BE",
      medicines: JSON.stringify([
        { name: "Timolol Eye Drops (0.5%)", days: "30", timing: "2 times/day" },
        { name: "Latanoprost Eye Drops (0.005%)", days: "30", timing: "Once at bedtime" },
      ]),
      items: [
        { description: "Senior Consultation", category: "Consultation", unitPrice: 500, amount: 500 },
        { description: "IOP (Tonometry)", category: "Diagnostic", unitPrice: 100, amount: 100 },
        { description: "Fundus Examination", category: "Diagnostic", unitPrice: 200, amount: 200 },
      ],
      total: 800, amountPaid: 500, balanceDue: 300, status: "COMPLETED",
    },
  ]

  for (const rx of prescriptions) {
    const rxId = id()
    await client.query(
      `INSERT INTO "Prescription" ("id","prescriptionNumber","patientId","doctorId","doctorName","presentComplaint","diagnosis","medicines","investigations","subtotal","discount","total","amountPaid","balanceDue","paymentMode","status","prescriptionDate","createdBy","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]',$9,0,$10,$11,$12,'CASH',$13,$14,$15,$16)
       ON CONFLICT ("prescriptionNumber") DO NOTHING`,
      [rxId, rx.prescriptionNumber, rx.patientPid, rx.doctorIdRef, rx.doctorName, rx.presentComplaint, rx.diagnosis, rx.medicines, rx.total, rx.total, rx.amountPaid, rx.balanceDue, rx.status, today.toISOString(), rx.doctorIdRef, today.toISOString()]
    )

    // Insert invoice items
    for (let i = 0; i < rx.items.length; i++) {
      const item = rx.items[i]
      await client.query(
        `INSERT INTO "InvoiceItem" ("id","prescriptionId","description","category","quantity","unitPrice","amount","sortOrder")
         VALUES ($1,$2,$3,$4,1,$5,$6,$7)`,
        [id(), rxId, item.description, item.category, item.unitPrice, item.amount, i + 1]
      )
    }

    // Insert payment for completed ones
    if (rx.amountPaid > 0) {
      await client.query(
        `INSERT INTO "Payment" ("id","prescriptionId","amount","paymentMode","receivedBy","paymentDate")
         VALUES ($1,$2,$3,'CASH',$4,$5)`,
        [id(), rxId, rx.amountPaid, receptionId, today.toISOString()]
      )
    }
  }
  console.log(`✅ ${prescriptions.length} prescriptions with items & payments created`)

  // ═══════════════════════════════════════════════════════
  // 14. SAMPLE EYE READINGS (for workup testing)
  // ═══════════════════════════════════════════════════════
  const eyeReadings = [
    {
      patientPid: "OP0001",
      autoRefractometer: JSON.stringify({ re: { sph: "+1.50", cyl: "-0.75", axis: "90" }, le: { sph: "+1.25", cyl: "-0.50", axis: "85" } }),
      glassesReading: JSON.stringify({ re: { sph: "+1.00", cyl: "-0.50", axis: "90", va: "6/12" }, le: { sph: "+0.75", cyl: "-0.25", axis: "85", va: "6/9" } }),
      presentPrescription: JSON.stringify({ re: { sph: "+1.50", cyl: "-0.75", axis: "90", va: "6/9" }, le: { sph: "+1.25", cyl: "-0.50", axis: "85", va: "6/6" } }),
    },
    {
      patientPid: "OP0008",
      autoRefractometer: JSON.stringify({ re: { sph: "-2.00", cyl: "-1.00", axis: "180" }, le: { sph: "-2.25", cyl: "-0.75", axis: "175" } }),
      glassesReading: JSON.stringify({ re: { sph: "-1.75", cyl: "-0.75", axis: "180", va: "6/9" }, le: { sph: "-2.00", cyl: "-0.50", axis: "175", va: "6/9" } }),
      presentPrescription: JSON.stringify({ re: { sph: "-2.00", cyl: "-1.00", axis: "180", va: "6/6" }, le: { sph: "-2.25", cyl: "-0.75", axis: "175", va: "6/6" } }),
    },
  ]

  for (const er of eyeReadings) {
    await client.query(
      `INSERT INTO "EyeReading" ("id","patientId","autoRefractometer","glassesReading","presentPrescription","readingDate","status","createdById","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,'COMPLETED',$7,$8)`,
      [id(), er.patientPid, er.autoRefractometer, er.glassesReading, er.presentPrescription, today.toISOString(), optometristId, today.toISOString()]
    )
  }
  console.log(`✅ ${eyeReadings.length} eye readings created`)

  // ═══════════════════════════════════════════════════════
  // 15. SAMPLE PHARMACY DATA
  // ═══════════════════════════════════════════════════════
  const supplierId = id()
  await client.query(
    `INSERT INTO "PharmacySupplier" ("id","name","contactPerson","phone","email","gstin","drugLicenseNo","creditDays","isActive","createdBy")
     VALUES ($1,'MedPlus Distributors','Sunil Verma','9111222333','medplus@example.com','36AABCD1234E1ZX','DL-20B-HYD-001',30,true,$2)
     ON CONFLICT ("name") DO NOTHING`,
    [supplierId, adminId]
  )

  const pharmaProducts = [
    { name: "Moxifloxacin Eye Drops 5ml", genericName: "Moxifloxacin 0.5%", manufacturer: "Cipla", category: "Eye Drop", mrp: 120, costPrice: 85, qty: 50 },
    { name: "Tobramycin Eye Drops 5ml", genericName: "Tobramycin 0.3%", manufacturer: "Sun Pharma", category: "Eye Drop", mrp: 95, costPrice: 65, qty: 40 },
    { name: "Prednisolone Eye Drops 10ml", genericName: "Prednisolone 1%", manufacturer: "Allergan", category: "Eye Drop", mrp: 180, costPrice: 130, qty: 30 },
    { name: "Timolol Eye Drops 5ml", genericName: "Timolol 0.5%", manufacturer: "FDC", category: "Eye Drop", mrp: 75, costPrice: 50, qty: 60 },
    { name: "Paracetamol 500mg Tab", genericName: "Paracetamol", manufacturer: "GSK", category: "Tablet", mrp: 25, costPrice: 15, qty: 200 },
  ]

  for (const p of pharmaProducts) {
    const medId = id()
    await client.query(
      `INSERT INTO "PharmacyMedicine" ("id","name","genericName","manufacturer","category","unitOfMeasure","gstPercent","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,'Nos',12,true,$6)
       ON CONFLICT ("name","manufacturer") DO NOTHING`,
      [medId, p.name, p.genericName, p.manufacturer, p.category, adminId]
    )

    const batchNo = `B${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 2)
    await client.query(
      `INSERT INTO "PharmacyStock" ("id","medicineId","batchNumber","quantity","mrp","costPrice","gstPercent","expiryDate","supplierId","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,12,$7,$8,true,$9)
       ON CONFLICT ("medicineId","batchNumber") DO NOTHING`,
      [id(), medId, batchNo, p.qty, p.mrp, p.costPrice, expiry.toISOString(), supplierId, adminId]
    )
  }
  console.log(`✅ ${pharmaProducts.length} pharmacy products with stock created`)

  // ═══════════════════════════════════════════════════════
  // 16. SAMPLE OPTICAL DATA
  // ═══════════════════════════════════════════════════════
  const opticalProducts = [
    { name: "Ray-Ban Full Rim", brand: "Ray-Ban", category: "Frame", type: "Full Rim", material: "Metal", mrp: 4500, costPrice: 2500, qty: 15 },
    { name: "Titan Half Rim", brand: "Titan", category: "Frame", type: "Half Rim", material: "TR90", mrp: 2200, costPrice: 1200, qty: 20 },
    { name: "Essilor SV 1.56", brand: "Essilor", category: "Lens", type: "Single Vision", material: "CR39", coating: "Blue Cut", index: "1.56", mrp: 1800, costPrice: 900, qty: 30 },
    { name: "Essilor Progressive 1.6", brand: "Essilor", category: "Lens", type: "Progressive", material: "Polycarbonate", coating: "AR Coating", index: "1.6", mrp: 5500, costPrice: 3000, qty: 10 },
    { name: "Bausch+Lomb Daily", brand: "Bausch+Lomb", category: "Contact Lens", type: "Daily", mrp: 850, costPrice: 550, qty: 25 },
  ]

  for (const op of opticalProducts) {
    const prodId = id()
    await client.query(
      `INSERT INTO "OpticalProduct" ("id","name","brand","category","type","material","coating","index","gstPercent","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,12,true,$9)
       ON CONFLICT ("name","brand") DO NOTHING`,
      [prodId, op.name, op.brand, op.category, op.type, op.material || null, op.coating || null, op.index || null, adminId]
    )

    await client.query(
      `INSERT INTO "OpticalStock" ("id","productId","batchNumber","quantity","mrp","costPrice","gstPercent","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,12,true,$7)
       ON CONFLICT ("productId","batchNumber","power") DO NOTHING`,
      [id(), prodId, `OB${Date.now().toString().slice(-6)}`, op.qty, op.mrp, op.costPrice, adminId]
    )
  }
  console.log(`✅ ${opticalProducts.length} optical products with stock created`)

  // ═══════════════════════════════════════════════════════
  // 17. SAMPLE LICENSE
  // ═══════════════════════════════════════════════════════
  const licenses = [
    { name: "Medical License", licenseNumber: "MCI-2024-001", issuingBody: "Medical Council of India", category: "Medical", daysToExpiry: 180 },
    { name: "Drug License", licenseNumber: "DL-20B-2024", issuingBody: "Drug Controller", category: "Drug", daysToExpiry: 90 },
    { name: "Fire Safety Certificate", licenseNumber: "FS-HYD-2024", issuingBody: "Fire Department", category: "Fire Safety", daysToExpiry: 30 },
  ]

  for (const lic of licenses) {
    const issue = new Date()
    issue.setFullYear(issue.getFullYear() - 1)
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + lic.daysToExpiry)
    await client.query(
      `INSERT INTO "License" ("id","name","licenseNumber","issuingBody","category","issueDate","expiryDate","reminderDays","status","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,30,'ACTIVE',$8)`,
      [id(), lic.name, lic.licenseNumber, lic.issuingBody, lic.category, issue.toISOString(), expiry.toISOString(), adminId]
    )
  }
  console.log(`✅ ${licenses.length} licenses created`)

  // ═══════════════════════════════════════════════════════
  // 18. PREDEFINED PACKAGES
  // ═══════════════════════════════════════════════════════
  const packages = [
    {
      name: "Cataract Surgery Package",
      totalAmount: 25000,
      discount: 2000,
      inclusions: JSON.stringify([
        { name: "Phacoemulsification + IOL", amount: 20000 },
        { name: "Pre-op investigations", amount: 3000 },
        { name: "Post-op medications", amount: 2000 },
      ]),
    },
    {
      name: "Glaucoma Evaluation Package",
      totalAmount: 3500,
      discount: 500,
      inclusions: JSON.stringify([
        { name: "Senior Consultation", amount: 500 },
        { name: "IOP (Tonometry)", amount: 100 },
        { name: "Visual Field Test", amount: 800 },
        { name: "OCT - Optic Nerve", amount: 1200 },
        { name: "Corneal Topography", amount: 900 },
      ]),
    },
  ]

  for (const pkg of packages) {
    await client.query(
      `INSERT INTO "PredefinedPackage" ("id","name","inclusions","totalAmount","discount","isActive","createdBy")
       VALUES ($1,$2,$3,$4,$5,true,$6)
       ON CONFLICT ("name") DO NOTHING`,
      [id(), pkg.name, pkg.inclusions, pkg.totalAmount, pkg.discount, adminId]
    )
  }
  console.log(`✅ ${packages.length} packages created`)

  // ═══════════════════════════════════════════════════════
  console.log("\n🎉 Seed complete!\n")
  console.log("Login credentials:")
  console.log("  Admin:        admin@docsile.com       / admin123")
  console.log("  Doctor:       doctor@docsile.com      / doctor123")
  console.log("  Doctor 2:     doctor2@docsile.com     / doctor123")
  console.log("  Reception:    reception@docsile.com   / reception123")
  console.log("  Optometrist:  optometrist@docsile.com / optom123")
  console.log("  Nurse:        nurse@docsile.com       / nurse123")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(() => client.end())
