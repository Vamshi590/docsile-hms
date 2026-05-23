import type { ElementType } from "react"
import {
  Users,
  Eye,
  Stethoscope,
  BedDouble,
  Shield,
  ClipboardList,
  FlaskConical,
  FileBarChart,
  Wallet,
  Pill,
  Glasses,
  ScrollText,
  DatabaseZap,
  BarChart3,
  UserCog,
  LayoutDashboard,
  Phone,
} from "lucide-react"

export type NavItem = {
  href: string
  icon: ElementType
  label: string
  exact?: boolean
  adminOnly?: boolean
  moduleCode?: string
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/patients", icon: Users, label: "Patients", moduleCode: "patients" },
      { href: "/workup", icon: Eye, label: "Refraction", moduleCode: "workup" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor", moduleCode: "doctor" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", moduleCode: "inpatients" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", moduleCode: "pharmacy" },
      { href: "/optical", icon: Glasses, label: "Optical", moduleCode: "optical" },
      { href: "/labs", icon: FlaskConical, label: "Labs", moduleCode: "labs" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", moduleCode: "call-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", icon: Shield, label: "Insurance", moduleCode: "insurance" },
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups" },
      { href: "/expenses", icon: Wallet, label: "Expenses", moduleCode: "expenses" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", moduleCode: "analytics" },
      { href: "/reports", icon: FileBarChart, label: "Reports", moduleCode: "reports" },
      { href: "/data", icon: DatabaseZap, label: "Data Export" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", moduleCode: "license-tracker" },
      { href: "/staff", icon: UserCog, label: "Staff", adminOnly: true },
    ],
  },
]
