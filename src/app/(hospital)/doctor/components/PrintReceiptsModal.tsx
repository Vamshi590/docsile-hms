"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CashReceipt } from "@/components/receipts/CashReceipt"
import { PrescriptionReceipt } from "@/components/receipts/PrescriptionReceipt"
import { ReadingsReceipt } from "@/components/receipts/ReadingsReceipt"
import { ClinicalFindingsReceipt } from "@/components/receipts/ClinicalFindingsReceipt"
import { ReadingsAndFindings } from "@/components/receipts/ReadingsAndFindings"
import { toGlassShape } from "@/lib/glass-prescription"
import { getReceiptData } from "../actions"
import { printReceiptsHtml } from "@/lib/print-receipts"
import { formatDate, calculateAge } from "@/lib/utils"

type ReceiptData = Awaited<ReturnType<typeof getReceiptData>>

interface PrintReceiptsModalProps {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
}

const TAB_CLASS =
  "rounded-none px-3 py-2 text-xs font-medium border-b-2 border-transparent " +
  "text-muted-foreground hover:text-foreground transition-colors " +
  "data-[state=active]:border-primary data-[state=active]:text-primary " +
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export function PrintReceiptsModal({ open, onClose, patientId, patientName }: PrintReceiptsModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReceiptData | null>(null)
  const [activeTab, setActiveTab] = useState("cash")
  const [readingsSubTab, setReadingsSubTab] = useState<"readings" | "clinical" | "both">("both")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !patientId) return
    setLoading(true)
    getReceiptData(patientId).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [open, patientId])

  function handlePrint() {
    if (!printRef.current) return
    printReceiptsHtml({
      title: `Print - ${patientName}`,
      contentHtml: printRef.current.innerHTML,
    })
  }

  if (!data && !loading) return null

  // Build shared patient info
  const patient = data?.patient
  const hospital = data?.hospital
  const prescription = data?.prescription
  const eyeReading = data?.eyeReading

  const patientInfo = patient ? {
    patientName: `${patient.firstName} ${patient.lastName ?? ""}`.trim(),
    patientId: patient.patientId,
    date: formatDate(prescription?.prescriptionDate ?? patient.appointmentDate),
    mobile: patient.phone || "—",
    gender: patient.gender,
    age: String(patient.age ?? calculateAge(patient.dateOfBirth) ?? "—"),
    address: patient.address || "—",
    referredBy: patient.referredBy || undefined,
    receiptNo: prescription?.prescriptionNumber || undefined,
    doctorName: prescription?.doctorName || patient.doctorName || "—",
    department: prescription?.department || patient.department || undefined,
  } : null

  const hospitalInfo = hospital ? {
    name: hospital.name,
    displayName: hospital.displayName,
    address: hospital.address,
    phone: hospital.phone,
    email: hospital.email,
    website: hospital.website,
    registrationNo: hospital.registrationNo,
    logoUrl: hospital.logoUrl,
  } : { name: "Hospital" }

  // Parse medicines from prescription
  let medicines: { name: string; timing: string; days: string; note?: string }[] = []
  if (prescription?.medicines) {
    try { medicines = JSON.parse(prescription.medicines) } catch { /* empty */ }
  }

  // Parse investigations
  let investigations: string[] = []
  if (prescription?.investigations) {
    try {
      const parsed = JSON.parse(prescription.investigations)
      investigations = parsed.map((i: { name: string }) => i.name)
    } catch { /* empty */ }
  }

  // Parse eye reading data
  let arReading: { rightEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string }; leftEye: { sph: string; cyl: string; axis: string; va: string; vacPh?: string } } | undefined
  let previousGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let presentGlass: { dist: { rightEye: any; leftEye: any }; near: { rightEye: any; leftEye: any } } | undefined
  let clinicalFindings: { rightEye: any; leftEye: any } | undefined

  if (eyeReading) {
    if (eyeReading.autoRefractometer) {
      try {
        const ar = JSON.parse(eyeReading.autoRefractometer)
        arReading = {
          rightEye: { sph: ar.re?.sph || "", cyl: ar.re?.cyl || "", axis: ar.re?.axis || "", va: ar.re?.va || "", vacPh: ar.re?.vacPh || "" },
          leftEye: { sph: ar.le?.sph || "", cyl: ar.le?.cyl || "", axis: ar.le?.axis || "", va: ar.le?.va || "", vacPh: ar.le?.vacPh || "" },
        }
      } catch { /* empty */ }
    }
    if (eyeReading.previousPrescription) {
      try { previousGlass = toGlassShape(JSON.parse(eyeReading.previousPrescription)) } catch { /* empty */ }
    }
    if (eyeReading.presentPrescription) {
      try { presentGlass = toGlassShape(JSON.parse(eyeReading.presentPrescription)) } catch { /* empty */ }
    }
    if (eyeReading.clinicalFindings) {
      try {
        const cf = JSON.parse(eyeReading.clinicalFindings)
        const defaultEye = {
          lids: "Normal", conjunctiva: "Normal", cornea: "Clear", ac: "Normal",
          iris: "Normal", pupil: "Normal", lens: "Clear", tension: "—",
          fundus: "—", opticDisk: "Normal", macula: "—", vessels: "—",
          peripheralRetina: "—", retinoscopy: "—", retino1: "—", retino2: "—", retino3: "—", retino4: "—",
        }
        clinicalFindings = {
          rightEye: { ...defaultEye, ...cf.re },
          leftEye: { ...defaultEye, ...cf.le },
        }
      } catch { /* empty */ }
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[870px] max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-row items-center justify-between">
          <DialogTitle className="text-base">Print Receipts — {patientName}</DialogTitle>
          <Button size="sm" onClick={handlePrint} disabled={loading} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading receipt data...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-border px-4">
              <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 -mb-px">
                <TabsTrigger value="cash" className={TAB_CLASS}>Cash Receipt</TabsTrigger>
                <TabsTrigger value="prescription" className={TAB_CLASS}>Prescription</TabsTrigger>
                <TabsTrigger value="readings" className={TAB_CLASS}>Readings & Findings</TabsTrigger>
                <TabsTrigger value="report" className={TAB_CLASS}>Report</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
              <div ref={printRef}>
                {/* Cash Receipt */}
                <TabsContent value="cash" className="mt-0">
                  {patientInfo && prescription && (
                    <CashReceipt
                      hospital={hospitalInfo}
                      patient={patientInfo}
                      payment={{
                        mode: prescription.paymentMode || "Cash",
                        totalAmount: prescription.subtotal ?? prescription.total ?? 0,
                        discount: prescription.discount ?? 0,
                        amountReceived: prescription.amountPaid ?? 0,
                        amountDue: prescription.balanceDue ?? 0,
                        paidFor: prescription.items?.map((i: any) => i.description).join(", ") || undefined,
                      }}
                      items={prescription.items?.map((i: any) => ({ description: i.description, amount: i.amount })) || undefined}
                    />
                  )}
                  {!prescription && (
                    <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
                      No billing data available for this patient
                    </div>
                  )}
                </TabsContent>

                {/* Prescription Receipt */}
                <TabsContent value="prescription" className="mt-0">
                  {patientInfo && (
                    <PrescriptionReceipt
                      hospital={hospitalInfo}
                      patient={patientInfo}
                      vitals={prescription ? {
                        temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                        pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                        spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                      } : undefined}
                      history={prescription ? {
                        presentComplaint: prescription.presentComplaint || undefined,
                        previousHistory: prescription.previousHistory || undefined,
                        diagnosis: prescription.diagnosis || undefined,
                      } : undefined}
                      medicines={medicines}
                      investigations={investigations}
                      advice={prescription?.additionalNotes || undefined}
                      followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                      notes={prescription?.notes || undefined}
                    />
                  )}
                </TabsContent>

                {/* Readings & Findings */}
                <TabsContent value="readings" className="mt-0 space-y-4">
                  {/* Sub-tab selector */}
                  <div className="flex gap-1 bg-white rounded-lg border p-1 w-fit mx-auto">
                    {(["readings", "clinical", "both"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setReadingsSubTab(t)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          readingsSubTab === t
                            ? "bg-primary text-white"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t === "readings" ? "Readings" : t === "clinical" ? "Clinical Findings" : "Both"}
                      </button>
                    ))}
                  </div>

                  {readingsSubTab === "readings" && patientInfo && (
                    <ReadingsReceipt
                      hospital={hospitalInfo}
                      patient={patientInfo}
                      arReading={arReading}
                      previousGlass={previousGlass}
                      presentGlass={presentGlass}
                    />
                  )}

                  {readingsSubTab === "clinical" && clinicalFindings && (
                    <ClinicalFindingsReceipt
                      hospital={hospitalInfo}
                      rightEye={clinicalFindings.rightEye}
                      leftEye={clinicalFindings.leftEye}
                    />
                  )}

                  {readingsSubTab === "both" && patientInfo && (
                    <ReadingsAndFindings
                      hospital={hospitalInfo}
                      patient={patientInfo}
                      arReading={arReading}
                      previousGlass={previousGlass}
                      presentGlass={presentGlass}
                      clinicalFindings={clinicalFindings}
                    />
                  )}

                  {!eyeReading && (
                    <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-lg border">
                      No eye reading data available for this patient
                    </div>
                  )}
                </TabsContent>

                {/* Full Report */}
                <TabsContent value="report" className="mt-0 space-y-0">
                  {patientInfo && (
                    <>
                      {/* Prescription page */}
                      <PrescriptionReceipt
                        hospital={hospitalInfo}
                        patient={patientInfo}
                        vitals={prescription ? {
                          temperature: prescription.temperature ? String(prescription.temperature) : undefined,
                          pulseRate: prescription.pulseRate ? String(prescription.pulseRate) : undefined,
                          spo2: prescription.spo2 ? String(prescription.spo2) : undefined,
                        } : undefined}
                        history={prescription ? {
                          presentComplaint: prescription.presentComplaint || undefined,
                          previousHistory: prescription.previousHistory || undefined,
                          diagnosis: prescription.diagnosis || undefined,
                        } : undefined}
                        medicines={medicines}
                        investigations={investigations}
                        advice={prescription?.additionalNotes || undefined}
                        followUpDate={prescription?.followUpDate ? formatDate(prescription.followUpDate) : undefined}
                        notes={prescription?.notes || undefined}
                      />
                      {/* Readings & Findings page */}
                      {eyeReading && (
                        <ReadingsAndFindings
                          hospital={hospitalInfo}
                          patient={patientInfo}
                          arReading={arReading}
                          previousGlass={previousGlass}
                          presentGlass={presentGlass}
                          clinicalFindings={clinicalFindings}
                        />
                      )}
                    </>
                  )}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
