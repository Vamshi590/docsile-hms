// Generated Database types for Supabase
// Based on Prisma schema — column names are camelCase (Prisma default, no @map directives)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      CallLog: {
        Row: {
          id: string
          exotelCallSid: string | null
          callFrom: string
          callTo: string
          direction: string
          status: string
          startTime: string | null
          endTime: string | null
          duration: number
          recordingUrl: string | null
          callerName: string | null
          patientId: string | null
          notes: string | null
          rawResponse: Json | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          exotelCallSid?: string | null
          callFrom: string
          callTo: string
          direction?: string
          status?: string
          startTime?: string | null
          endTime?: string | null
          duration?: number
          recordingUrl?: string | null
          callerName?: string | null
          patientId?: string | null
          notes?: string | null
          rawResponse?: Json | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          exotelCallSid?: string | null
          callFrom?: string
          callTo?: string
          direction?: string
          status?: string
          startTime?: string | null
          endTime?: string | null
          duration?: number
          recordingUrl?: string | null
          callerName?: string | null
          patientId?: string | null
          notes?: string | null
          rawResponse?: Json | null
          updatedAt?: string
        }
      }
      User: {
        Row: {
          id: string
          email: string
          passwordHash: string
          fullName: string
          phone: string | null
          role: string
          department: string | null
          designation: string | null
          isActive: boolean
          lastLogin: string | null
          employeeId: string | null
          qualifications: string | null
          joiningDate: string | null
          address: string | null
          emergencyContact: string | null
          bloodGroup: string | null
          salary: number | null
          salaryType: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          email: string
          passwordHash: string
          fullName: string
          phone?: string | null
          role?: string
          department?: string | null
          designation?: string | null
          isActive?: boolean
          lastLogin?: string | null
          employeeId?: string | null
          qualifications?: string | null
          joiningDate?: string | null
          address?: string | null
          emergencyContact?: string | null
          bloodGroup?: string | null
          salary?: number | null
          salaryType?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          email?: string
          passwordHash?: string
          fullName?: string
          phone?: string | null
          role?: string
          department?: string | null
          designation?: string | null
          isActive?: boolean
          lastLogin?: string | null
          employeeId?: string | null
          qualifications?: string | null
          joiningDate?: string | null
          address?: string | null
          emergencyContact?: string | null
          bloodGroup?: string | null
          salary?: number | null
          salaryType?: string | null
          updatedAt?: string
        }
      }
      Role: {
        Row: {
          id: string
          name: string
          displayName: string
          description: string | null
          permissions: string
          isSystem: boolean
          isActive: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          displayName: string
          description?: string | null
          permissions?: string
          isSystem?: boolean
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          displayName?: string
          description?: string | null
          permissions?: string
          isSystem?: boolean
          isActive?: boolean
          updatedAt?: string
        }
      }
      HospitalProfile: {
        Row: {
          id: string
          name: string
          displayName: string | null
          address: string | null
          phone: string | null
          email: string | null
          website: string | null
          logoUrl: string | null
          registrationNo: string | null
          gstin: string | null
          settings: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          displayName?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logoUrl?: string | null
          registrationNo?: string | null
          gstin?: string | null
          settings?: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          displayName?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logoUrl?: string | null
          registrationNo?: string | null
          gstin?: string | null
          settings?: string
          updatedAt?: string
        }
      }
      ServiceTemplate: {
        Row: {
          id: string
          name: string
          category: string
          description: string | null
          amount: number
          discount: number
          isActive: boolean
          sortOrder: number
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          description?: string | null
          amount?: number
          discount?: number
          isActive?: boolean
          sortOrder?: number
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string | null
          amount?: number
          discount?: number
          isActive?: boolean
          sortOrder?: number
          updatedAt?: string
        }
      }
      Patient: {
        Row: {
          id: string
          patientId: string
          firstName: string
          lastName: string | null
          dateOfBirth: string | null
          age: number | null
          gender: string
          phone: string
          email: string | null
          address: string | null
          guardianName: string | null
          guardianRelation: string | null
          emergencyContact: string | null
          referredBy: string | null
          doctorName: string | null
          department: string | null
          patientType: string
          status: string
          appointmentDate: string
          movedFromDate: string | null
          movedToDate: string | null
          moveReason: string | null
          notes: string | null
          createdById: string | null
          updatedBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          patientId: string
          firstName: string
          lastName?: string | null
          dateOfBirth?: string | null
          age?: number | null
          gender: string
          phone: string
          email?: string | null
          address?: string | null
          guardianName?: string | null
          guardianRelation?: string | null
          emergencyContact?: string | null
          referredBy?: string | null
          doctorName?: string | null
          department?: string | null
          patientType?: string
          status?: string
          appointmentDate: string
          movedFromDate?: string | null
          movedToDate?: string | null
          moveReason?: string | null
          notes?: string | null
          createdById?: string | null
          updatedBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          patientId?: string
          firstName?: string
          lastName?: string | null
          dateOfBirth?: string | null
          age?: number | null
          gender?: string
          phone?: string
          email?: string | null
          address?: string | null
          guardianName?: string | null
          guardianRelation?: string | null
          emergencyContact?: string | null
          referredBy?: string | null
          doctorName?: string | null
          department?: string | null
          patientType?: string
          status?: string
          appointmentDate?: string
          movedFromDate?: string | null
          movedToDate?: string | null
          moveReason?: string | null
          notes?: string | null
          updatedBy?: string | null
          updatedAt?: string
        }
      }
      Prescription: {
        Row: {
          id: string
          prescriptionNumber: string | null
          patientId: string
          patientType: string
          doctorId: string | null
          doctorName: string | null
          department: string | null
          temperature: number | null
          pulseRate: number | null
          spo2: number | null
          presentComplaint: string | null
          previousHistory: string | null
          diagnosis: string | null
          additionalNotes: string | null
          medicines: string
          investigations: string
          followUpDate: string | null
          notes: string | null
          subtotal: number
          discount: number
          discountReason: string | null
          total: number
          amountPaid: number
          balanceDue: number
          paymentMode: string | null
          paymentDate: string | null
          status: string
          prescriptionDate: string
          createdBy: string
          updatedBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          prescriptionNumber?: string | null
          patientId: string
          patientType?: string
          doctorId?: string | null
          doctorName?: string | null
          department?: string | null
          temperature?: number | null
          pulseRate?: number | null
          spo2?: number | null
          presentComplaint?: string | null
          previousHistory?: string | null
          diagnosis?: string | null
          additionalNotes?: string | null
          medicines?: string
          investigations?: string
          followUpDate?: string | null
          notes?: string | null
          subtotal?: number
          discount?: number
          discountReason?: string | null
          total?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          paymentDate?: string | null
          status?: string
          prescriptionDate: string
          createdBy: string
          updatedBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          prescriptionNumber?: string | null
          patientId?: string
          patientType?: string
          doctorId?: string | null
          doctorName?: string | null
          department?: string | null
          temperature?: number | null
          pulseRate?: number | null
          spo2?: number | null
          presentComplaint?: string | null
          previousHistory?: string | null
          diagnosis?: string | null
          additionalNotes?: string | null
          medicines?: string
          investigations?: string
          followUpDate?: string | null
          notes?: string | null
          subtotal?: number
          discount?: number
          discountReason?: string | null
          total?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          paymentDate?: string | null
          status?: string
          updatedBy?: string | null
          updatedAt?: string
        }
      }
      InvoiceItem: {
        Row: {
          id: string
          prescriptionId: string
          description: string
          category: string | null
          quantity: number
          unitPrice: number
          amount: number
          sortOrder: number
        }
        Insert: {
          id?: string
          prescriptionId: string
          description: string
          category?: string | null
          quantity?: number
          unitPrice: number
          amount: number
          sortOrder?: number
        }
        Update: {
          id?: string
          prescriptionId?: string
          description?: string
          category?: string | null
          quantity?: number
          unitPrice?: number
          amount?: number
          sortOrder?: number
        }
      }
      Payment: {
        Row: {
          id: string
          prescriptionId: string
          amount: number
          paymentMode: string
          paymentRef: string | null
          receivedBy: string | null
          paymentDate: string
          notes: string | null
        }
        Insert: {
          id?: string
          prescriptionId: string
          amount: number
          paymentMode: string
          paymentRef?: string | null
          receivedBy?: string | null
          paymentDate?: string
          notes?: string | null
        }
        Update: {
          id?: string
          prescriptionId?: string
          amount?: number
          paymentMode?: string
          paymentRef?: string | null
          receivedBy?: string | null
          paymentDate?: string
          notes?: string | null
        }
      }
      EyeReading: {
        Row: {
          id: string
          patientId: string
          prescriptionId: string | null
          autoRefractometer: string | null
          glassesReading: string | null
          previousPrescription: string | null
          presentPrescription: string | null
          clinicalFindings: string | null
          readingDate: string
          status: string
          createdById: string | null
          updatedBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          patientId: string
          prescriptionId?: string | null
          autoRefractometer?: string | null
          glassesReading?: string | null
          previousPrescription?: string | null
          presentPrescription?: string | null
          clinicalFindings?: string | null
          readingDate: string
          status?: string
          createdById?: string | null
          updatedBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          patientId?: string
          prescriptionId?: string | null
          autoRefractometer?: string | null
          glassesReading?: string | null
          previousPrescription?: string | null
          presentPrescription?: string | null
          clinicalFindings?: string | null
          readingDate?: string
          status?: string
          updatedBy?: string | null
          updatedAt?: string
        }
      }
      PredefinedTemplate: {
        Row: {
          id: string
          code: string
          name: string
          presentComplaint: string | null
          previousHistory: string | null
          provisionalDiagnosis: string | null
          medicines: string
          investigations: string
          followUpDays: number | null
          additionalNotes: string | null
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          presentComplaint?: string | null
          previousHistory?: string | null
          provisionalDiagnosis?: string | null
          medicines?: string
          investigations?: string
          followUpDays?: number | null
          additionalNotes?: string | null
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          presentComplaint?: string | null
          previousHistory?: string | null
          provisionalDiagnosis?: string | null
          medicines?: string
          investigations?: string
          followUpDays?: number | null
          additionalNotes?: string | null
          isActive?: boolean
          updatedAt?: string
        }
      }
      MedicineMaster: {
        Row: {
          id: string
          name: string
          defaultTiming: string | null
          defaultDays: string | null
          category: string | null
          note: string | null
          isActive: boolean
          sortOrder: number
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          defaultTiming?: string | null
          defaultDays?: string | null
          category?: string | null
          note?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          defaultTiming?: string | null
          defaultDays?: string | null
          category?: string | null
          note?: string | null
          isActive?: boolean
          sortOrder?: number
          updatedAt?: string
        }
      }
      InvestigationMaster: {
        Row: {
          id: string
          name: string
          category: string | null
          description: string | null
          isActive: boolean
          sortOrder: number
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          description?: string | null
          isActive?: boolean
          sortOrder?: number
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          description?: string | null
          isActive?: boolean
          sortOrder?: number
          updatedAt?: string
        }
      }
      DropdownOption: {
        Row: {
          id: string
          fieldName: string
          value: string
          createdBy: string
          createdAt: string
        }
        Insert: {
          id?: string
          fieldName: string
          value: string
          createdBy: string
          createdAt?: string
        }
        Update: {
          id?: string
          fieldName?: string
          value?: string
        }
      }
      PredefinedPackage: {
        Row: {
          id: string
          name: string
          inclusions: string
          totalAmount: number
          discount: number
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          inclusions?: string
          totalAmount?: number
          discount?: number
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          inclusions?: string
          totalAmount?: number
          discount?: number
          isActive?: boolean
          updatedAt?: string
        }
      }
      InPatient: {
        Row: {
          id: string
          patientId: string
          ipNumber: string
          name: string
          age: number
          gender: string
          phone: string
          address: string | null
          dateOfBirth: string | null
          guardianName: string | null
          admissionDate: string
          admissionNotes: string | null
          referredBy: string | null
          department: string | null
          doctorNames: string
          onDutyDoctor: string | null
          operationName: string | null
          operationDate: string | null
          operationProcedure: string | null
          operationDetails: string | null
          provisionDiagnosis: string | null
          medicalValues: string | null
          packageAmount: number
          packageInclusions: string | null
          discount: number
          netAmount: number
          totalReceivedAmount: number
          balanceAmount: number
          paymentRecords: string | null
          prescriptions: string | null
          followUpDate: string | null
          status: string
          dischargeDate: string | null
          dischargeNotes: string | null
          bedNumber: string | null
          wardName: string | null
          createdById: string | null
          updatedBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          patientId: string
          ipNumber: string
          name: string
          age: number
          gender: string
          phone: string
          address?: string | null
          dateOfBirth?: string | null
          guardianName?: string | null
          admissionDate: string
          admissionNotes?: string | null
          referredBy?: string | null
          department?: string | null
          doctorNames?: string
          onDutyDoctor?: string | null
          operationName?: string | null
          operationDate?: string | null
          operationProcedure?: string | null
          operationDetails?: string | null
          provisionDiagnosis?: string | null
          medicalValues?: string | null
          packageAmount?: number
          packageInclusions?: string | null
          discount?: number
          netAmount?: number
          totalReceivedAmount?: number
          balanceAmount?: number
          paymentRecords?: string | null
          prescriptions?: string | null
          followUpDate?: string | null
          status?: string
          dischargeDate?: string | null
          dischargeNotes?: string | null
          bedNumber?: string | null
          wardName?: string | null
          createdById?: string | null
          updatedBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          patientId?: string
          ipNumber?: string
          name?: string
          age?: number
          gender?: string
          phone?: string
          address?: string | null
          dateOfBirth?: string | null
          guardianName?: string | null
          admissionDate?: string
          admissionNotes?: string | null
          referredBy?: string | null
          department?: string | null
          doctorNames?: string
          onDutyDoctor?: string | null
          operationName?: string | null
          operationDate?: string | null
          operationProcedure?: string | null
          operationDetails?: string | null
          provisionDiagnosis?: string | null
          medicalValues?: string | null
          packageAmount?: number
          packageInclusions?: string | null
          discount?: number
          netAmount?: number
          totalReceivedAmount?: number
          balanceAmount?: number
          paymentRecords?: string | null
          prescriptions?: string | null
          followUpDate?: string | null
          status?: string
          dischargeDate?: string | null
          dischargeNotes?: string | null
          bedNumber?: string | null
          wardName?: string | null
          updatedBy?: string | null
          updatedAt?: string
        }
      }
      InsuranceCompany: {
        Row: {
          id: string
          name: string
          tpaName: string | null
          contactNumber: string | null
          email: string | null
          address: string | null
          isActive: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          tpaName?: string | null
          contactNumber?: string | null
          email?: string | null
          address?: string | null
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          tpaName?: string | null
          contactNumber?: string | null
          email?: string | null
          address?: string | null
          isActive?: boolean
          updatedAt?: string
        }
      }
      InsuranceClaim: {
        Row: {
          id: string
          claimNumber: string
          inPatientId: string
          insuranceCompanyId: string | null
          patientName: string
          ipNumber: string
          age: number
          gender: string
          phone: string
          guardianName: string | null
          department: string | null
          doctorNames: string
          operationName: string | null
          provisionDiagnosis: string | null
          admissionDate: string
          dischargeDate: string | null
          insuranceCompanyName: string
          tpaName: string | null
          policyNumber: string | null
          policyHolderName: string | null
          insuranceCardNumber: string | null
          relationToInsured: string | null
          packageAmount: number
          totalBillAmount: number
          preauthAmount: number
          enhancementAmount: number
          enhancementApproved: number
          totalApprovedAmount: number
          finalSettledAmount: number
          deductions: number
          discount: number
          patientPayableAmount: number
          patientPaidAmount: number
          patientBalance: number
          status: string
          preauthSubmittedDate: string | null
          preauthApprovedDate: string | null
          preauthRejectionReason: string | null
          preauthQueryNotes: string | null
          enhancementClaimedDate: string | null
          enhancementApprovedDate: string | null
          enhancementRejectionReason: string | null
          enhancementQueryNotes: string | null
          finalBillSubmittedDate: string | null
          settlementDate: string | null
          settlementReference: string | null
          statusHistory: string | null
          notes: string | null
          packageInclusions: string | null
          createdById: string | null
          updatedBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          claimNumber: string
          inPatientId: string
          insuranceCompanyId?: string | null
          patientName: string
          ipNumber: string
          age: number
          gender: string
          phone: string
          guardianName?: string | null
          department?: string | null
          doctorNames?: string
          operationName?: string | null
          provisionDiagnosis?: string | null
          admissionDate: string
          dischargeDate?: string | null
          insuranceCompanyName: string
          tpaName?: string | null
          policyNumber?: string | null
          policyHolderName?: string | null
          insuranceCardNumber?: string | null
          relationToInsured?: string | null
          packageAmount?: number
          totalBillAmount?: number
          preauthAmount?: number
          enhancementAmount?: number
          enhancementApproved?: number
          totalApprovedAmount?: number
          finalSettledAmount?: number
          deductions?: number
          discount?: number
          patientPayableAmount?: number
          patientPaidAmount?: number
          patientBalance?: number
          status?: string
          preauthSubmittedDate?: string | null
          preauthApprovedDate?: string | null
          preauthRejectionReason?: string | null
          preauthQueryNotes?: string | null
          enhancementClaimedDate?: string | null
          enhancementApprovedDate?: string | null
          enhancementRejectionReason?: string | null
          enhancementQueryNotes?: string | null
          finalBillSubmittedDate?: string | null
          settlementDate?: string | null
          settlementReference?: string | null
          statusHistory?: string | null
          notes?: string | null
          packageInclusions?: string | null
          createdById?: string | null
          updatedBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          claimNumber?: string
          inPatientId?: string
          insuranceCompanyId?: string | null
          patientName?: string
          ipNumber?: string
          age?: number
          gender?: string
          phone?: string
          guardianName?: string | null
          department?: string | null
          doctorNames?: string
          operationName?: string | null
          provisionDiagnosis?: string | null
          admissionDate?: string
          dischargeDate?: string | null
          insuranceCompanyName?: string
          tpaName?: string | null
          policyNumber?: string | null
          policyHolderName?: string | null
          insuranceCardNumber?: string | null
          relationToInsured?: string | null
          packageAmount?: number
          totalBillAmount?: number
          preauthAmount?: number
          enhancementAmount?: number
          enhancementApproved?: number
          totalApprovedAmount?: number
          finalSettledAmount?: number
          deductions?: number
          discount?: number
          patientPayableAmount?: number
          patientPaidAmount?: number
          patientBalance?: number
          status?: string
          preauthSubmittedDate?: string | null
          preauthApprovedDate?: string | null
          preauthRejectionReason?: string | null
          preauthQueryNotes?: string | null
          enhancementClaimedDate?: string | null
          enhancementApprovedDate?: string | null
          enhancementRejectionReason?: string | null
          enhancementQueryNotes?: string | null
          finalBillSubmittedDate?: string | null
          settlementDate?: string | null
          settlementReference?: string | null
          statusHistory?: string | null
          notes?: string | null
          packageInclusions?: string | null
          updatedBy?: string | null
          updatedAt?: string
        }
      }
      Lab: {
        Row: {
          id: string
          name: string
          description: string | null
          location: string | null
          isActive: boolean
          sortOrder: number
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          location?: string | null
          isActive?: boolean
          sortOrder?: number
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          location?: string | null
          isActive?: boolean
          sortOrder?: number
          updatedAt?: string
        }
      }
      LabInvestigation: {
        Row: {
          id: string
          labId: string
          investigationId: string
          amount: number
          isDefault: boolean
          isActive: boolean
        }
        Insert: {
          id?: string
          labId: string
          investigationId: string
          amount: number
          isDefault?: boolean
          isActive?: boolean
        }
        Update: {
          id?: string
          labId?: string
          investigationId?: string
          amount?: number
          isDefault?: boolean
          isActive?: boolean
        }
      }
      LabBill: {
        Row: {
          id: string
          billNumber: string
          labId: string
          patientId: string
          prescriptionId: string
          subtotal: number
          discount: number
          discountReason: string | null
          total: number
          amountPaid: number
          balanceDue: number
          paymentMode: string | null
          paymentDate: string | null
          status: string
          notes: string | null
          createdBy: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          billNumber: string
          labId: string
          patientId: string
          prescriptionId: string
          subtotal?: number
          discount?: number
          discountReason?: string | null
          total?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          paymentDate?: string | null
          status?: string
          notes?: string | null
          createdBy?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          billNumber?: string
          labId?: string
          patientId?: string
          prescriptionId?: string
          subtotal?: number
          discount?: number
          discountReason?: string | null
          total?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          paymentDate?: string | null
          status?: string
          notes?: string | null
          updatedAt?: string
        }
      }
      LabBillItem: {
        Row: {
          id: string
          labBillId: string
          investigationId: string | null
          name: string
          amount: number
          sortOrder: number
        }
        Insert: {
          id?: string
          labBillId: string
          investigationId?: string | null
          name: string
          amount: number
          sortOrder?: number
        }
        Update: {
          id?: string
          labBillId?: string
          investigationId?: string | null
          name?: string
          amount?: number
          sortOrder?: number
        }
      }
      LabPayment: {
        Row: {
          id: string
          labBillId: string
          amount: number
          paymentMode: string
          paymentRef: string | null
          receivedBy: string | null
          paymentDate: string
          notes: string | null
        }
        Insert: {
          id?: string
          labBillId: string
          amount: number
          paymentMode: string
          paymentRef?: string | null
          receivedBy?: string | null
          paymentDate?: string
          notes?: string | null
        }
        Update: {
          id?: string
          labBillId?: string
          amount?: number
          paymentMode?: string
          paymentRef?: string | null
          receivedBy?: string | null
          paymentDate?: string
          notes?: string | null
        }
      }
      ExpenseCategory: {
        Row: {
          id: string
          name: string
          color: string
          icon: string | null
          sortOrder: number
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          icon?: string | null
          sortOrder?: number
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          icon?: string | null
          sortOrder?: number
          isActive?: boolean
          updatedAt?: string
        }
      }
      Expense: {
        Row: {
          id: string
          title: string
          categoryId: string
          amount: number
          date: string
          reason: string | null
          paymentMode: string | null
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          title: string
          categoryId: string
          amount: number
          date: string
          reason?: string | null
          paymentMode?: string | null
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          title?: string
          categoryId?: string
          amount?: number
          date?: string
          reason?: string | null
          paymentMode?: string | null
          updatedAt?: string
        }
      }
      PharmacyMedicine: {
        Row: {
          id: string
          name: string
          genericName: string | null
          manufacturer: string | null
          composition: string | null
          category: string | null
          dosageForm: string | null
          strength: string | null
          unitOfMeasure: string
          hsnCode: string | null
          gstPercent: number
          scheduleType: string | null
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          genericName?: string | null
          manufacturer?: string | null
          composition?: string | null
          category?: string | null
          dosageForm?: string | null
          strength?: string | null
          unitOfMeasure?: string
          hsnCode?: string | null
          gstPercent?: number
          scheduleType?: string | null
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          genericName?: string | null
          manufacturer?: string | null
          composition?: string | null
          category?: string | null
          dosageForm?: string | null
          strength?: string | null
          unitOfMeasure?: string
          hsnCode?: string | null
          gstPercent?: number
          scheduleType?: string | null
          isActive?: boolean
          updatedAt?: string
        }
      }
      PharmacyStock: {
        Row: {
          id: string
          medicineId: string
          batchNumber: string
          quantity: number
          mrp: number
          costPrice: number
          gstPercent: number
          unitsPerPack: number
          expiryDate: string
          manufacturingDate: string | null
          supplierId: string | null
          purchaseOrderId: string | null
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          medicineId: string
          batchNumber: string
          quantity?: number
          mrp?: number
          costPrice?: number
          gstPercent?: number
          unitsPerPack?: number
          expiryDate: string
          manufacturingDate?: string | null
          supplierId?: string | null
          purchaseOrderId?: string | null
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          medicineId?: string
          batchNumber?: string
          quantity?: number
          mrp?: number
          costPrice?: number
          gstPercent?: number
          unitsPerPack?: number
          expiryDate?: string
          manufacturingDate?: string | null
          supplierId?: string | null
          purchaseOrderId?: string | null
          isActive?: boolean
          updatedAt?: string
        }
      }
      PharmacySupplier: {
        Row: {
          id: string
          name: string
          contactPerson: string | null
          phone: string | null
          email: string | null
          address: string | null
          gstin: string | null
          drugLicenseNo: string | null
          creditDays: number
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          contactPerson?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          gstin?: string | null
          drugLicenseNo?: string | null
          creditDays?: number
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          contactPerson?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          gstin?: string | null
          drugLicenseNo?: string | null
          creditDays?: number
          isActive?: boolean
          updatedAt?: string
        }
      }
      PurchaseOrder: {
        Row: {
          id: string
          orderNumber: string
          supplierId: string
          orderDate: string
          expectedDate: string | null
          invoiceNumber: string | null
          invoiceDate: string | null
          subtotal: number
          gstAmount: number
          discount: number
          totalAmount: number
          amountPaid: number
          balanceDue: number
          paymentMode: string | null
          status: string
          notes: string | null
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          orderNumber: string
          supplierId: string
          orderDate?: string
          expectedDate?: string | null
          invoiceNumber?: string | null
          invoiceDate?: string | null
          subtotal?: number
          gstAmount?: number
          discount?: number
          totalAmount?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          status?: string
          notes?: string | null
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          orderNumber?: string
          supplierId?: string
          orderDate?: string
          expectedDate?: string | null
          invoiceNumber?: string | null
          invoiceDate?: string | null
          subtotal?: number
          gstAmount?: number
          discount?: number
          totalAmount?: number
          amountPaid?: number
          balanceDue?: number
          paymentMode?: string | null
          status?: string
          notes?: string | null
          updatedAt?: string
        }
      }
      PurchaseOrderItem: {
        Row: {
          id: string
          purchaseOrderId: string
          medicineId: string
          batchNumber: string | null
          quantity: number
          receivedQty: number
          costPrice: number
          mrp: number
          gstPercent: number
          expiryDate: string | null
          amount: number
        }
        Insert: {
          id?: string
          purchaseOrderId: string
          medicineId: string
          batchNumber?: string | null
          quantity?: number
          receivedQty?: number
          costPrice?: number
          mrp?: number
          gstPercent?: number
          expiryDate?: string | null
          amount?: number
        }
        Update: {
          id?: string
          purchaseOrderId?: string
          medicineId?: string
          batchNumber?: string | null
          quantity?: number
          receivedQty?: number
          costPrice?: number
          mrp?: number
          gstPercent?: number
          expiryDate?: string | null
          amount?: number
        }
      }
      PharmacyBill: {
        Row: {
          id: string
          billNumber: string
          patientId: string | null
          patientName: string
          patientPhone: string | null
          gender: string | null
          email: string | null
          referredDoctor: string | null
          prescriptionId: string | null
          billDate: string
          subtotal: number
          discountPercent: number
          discountAmount: number
          gstAmount: number
          netAmount: number
          roundOff: number
          billAmount: number
          paidAmount: number
          balanceDue: number
          paymentMode: string
          paymentRef: string | null
          status: string
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          billNumber: string
          patientId?: string | null
          patientName: string
          patientPhone?: string | null
          gender?: string | null
          email?: string | null
          referredDoctor?: string | null
          prescriptionId?: string | null
          billDate?: string
          subtotal?: number
          discountPercent?: number
          discountAmount?: number
          gstAmount?: number
          netAmount?: number
          roundOff?: number
          billAmount?: number
          paidAmount?: number
          balanceDue?: number
          paymentMode?: string
          paymentRef?: string | null
          status?: string
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          billNumber?: string
          patientId?: string | null
          patientName?: string
          patientPhone?: string | null
          gender?: string | null
          email?: string | null
          referredDoctor?: string | null
          prescriptionId?: string | null
          billDate?: string
          subtotal?: number
          discountPercent?: number
          discountAmount?: number
          gstAmount?: number
          netAmount?: number
          roundOff?: number
          billAmount?: number
          paidAmount?: number
          balanceDue?: number
          paymentMode?: string
          paymentRef?: string | null
          status?: string
          updatedAt?: string
        }
      }
      PharmacyBillItem: {
        Row: {
          id: string
          billId: string
          stockId: string
          medicineName: string
          batchNumber: string
          quantity: number
          mrp: number
          price: number
          total: number
          discountPercent: number
          amount: number
          gstPercent: number
        }
        Insert: {
          id?: string
          billId: string
          stockId: string
          medicineName: string
          batchNumber: string
          quantity?: number
          mrp?: number
          price?: number
          total?: number
          discountPercent?: number
          amount?: number
          gstPercent?: number
        }
        Update: {
          id?: string
          billId?: string
          stockId?: string
          medicineName?: string
          batchNumber?: string
          quantity?: number
          mrp?: number
          price?: number
          total?: number
          discountPercent?: number
          amount?: number
          gstPercent?: number
        }
      }
      License: {
        Row: {
          id: string
          name: string
          licenseNumber: string | null
          issuingBody: string | null
          category: string | null
          issueDate: string | null
          expiryDate: string
          reminderDays: number
          status: string
          notes: string | null
          documentUrl: string | null
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          licenseNumber?: string | null
          issuingBody?: string | null
          category?: string | null
          issueDate?: string | null
          expiryDate: string
          reminderDays?: number
          status?: string
          notes?: string | null
          documentUrl?: string | null
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          licenseNumber?: string | null
          issuingBody?: string | null
          category?: string | null
          issueDate?: string | null
          expiryDate?: string
          reminderDays?: number
          status?: string
          notes?: string | null
          documentUrl?: string | null
          updatedAt?: string
        }
      }
      OpticalProduct: {
        Row: {
          id: string
          name: string
          brand: string | null
          category: string
          type: string | null
          material: string | null
          color: string | null
          size: string | null
          coating: string | null
          index: string | null
          modelNumber: string | null
          hsnCode: string | null
          gstPercent: number
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          brand?: string | null
          category: string
          type?: string | null
          material?: string | null
          color?: string | null
          size?: string | null
          coating?: string | null
          index?: string | null
          modelNumber?: string | null
          hsnCode?: string | null
          gstPercent?: number
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          brand?: string | null
          category?: string
          type?: string | null
          material?: string | null
          color?: string | null
          size?: string | null
          coating?: string | null
          index?: string | null
          modelNumber?: string | null
          hsnCode?: string | null
          gstPercent?: number
          isActive?: boolean
          updatedAt?: string
        }
      }
      OpticalStock: {
        Row: {
          id: string
          productId: string
          batchNumber: string | null
          quantity: number
          mrp: number
          costPrice: number
          gstPercent: number
          power: string | null
          supplierId: string | null
          isActive: boolean
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          productId: string
          batchNumber?: string | null
          quantity?: number
          mrp?: number
          costPrice?: number
          gstPercent?: number
          power?: string | null
          supplierId?: string | null
          isActive?: boolean
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          productId?: string
          batchNumber?: string | null
          quantity?: number
          mrp?: number
          costPrice?: number
          gstPercent?: number
          power?: string | null
          supplierId?: string | null
          isActive?: boolean
          updatedAt?: string
        }
      }
      OpticalBill: {
        Row: {
          id: string
          billNumber: string
          patientId: string | null
          patientName: string
          patientPhone: string | null
          gender: string | null
          referredDoctor: string | null
          prescriptionId: string | null
          lensPrescription: string | null
          billDate: string
          subtotal: number
          discountPercent: number
          discountAmount: number
          gstAmount: number
          netAmount: number
          roundOff: number
          billAmount: number
          paidAmount: number
          balanceDue: number
          paymentMode: string
          paymentRef: string | null
          deliveryDate: string | null
          orderNotes: string | null
          status: string
          createdBy: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          billNumber: string
          patientId?: string | null
          patientName: string
          patientPhone?: string | null
          gender?: string | null
          referredDoctor?: string | null
          prescriptionId?: string | null
          lensPrescription?: string | null
          billDate?: string
          subtotal?: number
          discountPercent?: number
          discountAmount?: number
          gstAmount?: number
          netAmount?: number
          roundOff?: number
          billAmount?: number
          paidAmount?: number
          balanceDue?: number
          paymentMode?: string
          paymentRef?: string | null
          deliveryDate?: string | null
          orderNotes?: string | null
          status?: string
          createdBy: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          billNumber?: string
          patientId?: string | null
          patientName?: string
          patientPhone?: string | null
          gender?: string | null
          referredDoctor?: string | null
          prescriptionId?: string | null
          lensPrescription?: string | null
          billDate?: string
          subtotal?: number
          discountPercent?: number
          discountAmount?: number
          gstAmount?: number
          netAmount?: number
          roundOff?: number
          billAmount?: number
          paidAmount?: number
          balanceDue?: number
          paymentMode?: string
          paymentRef?: string | null
          deliveryDate?: string | null
          orderNotes?: string | null
          status?: string
          updatedAt?: string
        }
      }
      OpticalBillItem: {
        Row: {
          id: string
          billId: string
          stockId: string | null
          itemName: string
          category: string
          eye: string | null
          quantity: number
          mrp: number
          price: number
          total: number
          discountPercent: number
          amount: number
          gstPercent: number
        }
        Insert: {
          id?: string
          billId: string
          stockId?: string | null
          itemName: string
          category: string
          eye?: string | null
          quantity?: number
          mrp?: number
          price?: number
          total?: number
          discountPercent?: number
          amount?: number
          gstPercent?: number
        }
        Update: {
          id?: string
          billId?: string
          stockId?: string | null
          itemName?: string
          category?: string
          eye?: string | null
          quantity?: number
          mrp?: number
          price?: number
          total?: number
          discountPercent?: number
          amount?: number
          gstPercent?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for common use
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
