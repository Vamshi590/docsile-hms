"use client"

import { useEffect } from "react"
import InsuranceFinalBill from "../../components/InsuranceFinalBill"
import InsuranceEnhancementBill from "../../components/InsuranceEnhancementBill"
import InsuranceCashReceipt from "../../components/InsuranceCashReceipt"
import { format } from "date-fns"

interface ReceiptData {
  type: string
  claim: {
    id: string
    claimNumber: string
    patientName: string
    ipNumber: string
    age: number
    gender: string
    phone: string
    guardianName: string | null
    department: string | null
    operationName: string | null
    provisionDiagnosis: string | null
    admissionDate: string
    dischargeDate: string
    insuranceCompanyName: string
    tpaName: string | null
    preauthAmount: number
    enhancementAmount: number
    enhancementApproved: number
    totalApprovedAmount: number
    finalSettledAmount: number
    deductions: number
    packageAmount: number
    totalBillAmount: number
    discount: number
    patientPayableAmount: number
    patientPaidAmount: number
    patientBalance: number
    createdAt: string
  }
  doctors: string[]
  billingItems: { particulars: string; amount: number }[]
}

export default function ReceiptRenderer({ data }: { data: ReceiptData }) {
  const { type, claim, doctors, billingItems } = data

  useEffect(() => {
    // Auto-print after rendering
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const patientData = {
    patientName: claim.patientName,
    patientId: claim.ipNumber,
    gender: claim.gender,
    age: String(claim.age),
    admissionDate: claim.admissionDate,
    dischargeDate: claim.dischargeDate,
    doctorSpecialization: doctors.join(", ") || "—",
    department: claim.department ?? "—",
  }

  if (type === "final") {
    return (
      <InsuranceFinalBill
        patientData={patientData}
        billDate={claim.createdAt}
        billingItems={billingItems}
        billingData={{
          totalAmount: claim.packageAmount,
          discountAmount: claim.discount,
          netAmount: claim.totalBillAmount,
        }}
        insuranceData={{
          companyName: claim.insuranceCompanyName,
          preauthAmount: claim.preauthAmount,
          enhancementApproved: claim.enhancementApproved,
          totalApproved: claim.totalApprovedAmount,
          finalSettled: claim.finalSettledAmount,
          deductions: claim.deductions,
          patientPayable: claim.patientPayableAmount,
        }}
      />
    )
  }

  if (type === "enhancement") {
    return (
      <InsuranceEnhancementBill
        patientData={patientData}
        billDate={claim.createdAt}
        billingItems={billingItems}
        enhancementData={{
          companyName: claim.insuranceCompanyName,
          preauthAmount: claim.preauthAmount,
          totalBillAmount: claim.totalBillAmount,
          excessAmount: Math.max(0, claim.totalBillAmount - claim.preauthAmount),
          enhancementRequested: claim.enhancementAmount,
        }}
      />
    )
  }

  // Cash receipt
  return (
    <InsuranceCashReceipt
      patientData={{
        billNumber: claim.claimNumber,
        patientId: claim.ipNumber,
        date: format(new Date(claim.createdAt), "dd/MM/yyyy"),
        patientName: claim.patientName,
        gender: claim.gender,
        guardianName: claim.guardianName ?? "",
        age: String(claim.age),
        address: "",
        mobile: claim.phone,
        doctorName: doctors[0] ?? "—",
        doctorNames: doctors.join(", "),
        onDutyDoctor: "",
        department: claim.department ?? "—",
        dateOfAdmit: claim.admissionDate ? format(new Date(claim.admissionDate), "dd/MM/yyyy") : "",
        dateOfDischarge: claim.dischargeDate ? format(new Date(claim.dischargeDate), "dd/MM/yyyy") : "",
        referredBy: "",
      }}
      billingItems={billingItems}
      billingData={{
        totalAmount: claim.packageAmount,
        advancePaid: 0,
        discountPercent: claim.packageAmount > 0 ? (claim.discount / claim.packageAmount) * 100 : 0,
        discountAmount: claim.discount,
        amountReceived: claim.patientPaidAmount,
        balance: claim.patientBalance,
      }}
      insuranceSummary={{
        companyName: claim.insuranceCompanyName,
        totalApproved: claim.totalApprovedAmount,
        finalSettled: claim.finalSettledAmount,
        patientPayable: claim.patientPayableAmount,
        patientPaid: claim.patientPaidAmount,
        patientBalance: claim.patientBalance,
      }}
    />
  )
}
