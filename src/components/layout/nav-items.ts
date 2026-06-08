import type { ElementType } from "react"
import {
  Users, Eye, Stethoscope, BedDouble, Shield, ClipboardList,
  FlaskConical, FileBarChart, Wallet, Pill, Glasses, ScrollText,
  DatabaseZap, BarChart3, UserCog, LayoutDashboard, Phone, Instagram,
} from "lucide-react"

export type NavItem = {
  href: string
  icon: ElementType
  label: string
  exact?: boolean
  moduleCode?: string
  permission?: string
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
      { href: "/patients", icon: Users, label: "Patients", moduleCode: "patients", permission: "patients:view" },
      { href: "/workup", icon: Eye, label: "Refraction", moduleCode: "workup", permission: "workup:view" },
      { href: "/doctor", icon: Stethoscope, label: "Doctor", moduleCode: "doctor", permission: "doctor:view" },
      { href: "/inpatients", icon: BedDouble, label: "In-Patients", moduleCode: "inpatients", permission: "inpatients:view" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/pharmacy", icon: Pill, label: "Pharmacy", moduleCode: "pharmacy", permission: "pharmacy:view" },
      { href: "/optical", icon: Glasses, label: "Optical", moduleCode: "optical", permission: "optical:view" },
      { href: "/labs", icon: FlaskConical, label: "Labs", moduleCode: "labs", permission: "labs:view" },
      { href: "/call-logs", icon: Phone, label: "Call Logs", moduleCode: "call-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", icon: Shield, label: "Insurance", moduleCode: "insurance", permission: "insurance:view" },
      { href: "/dues-followups", icon: ClipboardList, label: "Dues & Follow-Ups", permission: "dues:view" },
      { href: "/expenses", icon: Wallet, label: "Expenses", moduleCode: "expenses", permission: "expenses:view" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics", moduleCode: "analytics", permission: "reports:view" },
      { href: "/reports", icon: FileBarChart, label: "Reports", moduleCode: "reports", permission: "reports:view" },
      { href: "/data", icon: DatabaseZap, label: "Data Export", permission: "data:export" },
      { href: "/license-tracker", icon: ScrollText, label: "Licenses", moduleCode: "license-tracker", permission: "licenses:view" },
      { href: "/staff", icon: UserCog, label: "Staff", permission: "staff:view" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/social", icon: Instagram, label: "Social", moduleCode: "social", permission: "social:view" },
    ],
  },
]
