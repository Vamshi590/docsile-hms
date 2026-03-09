"use client"

import { useState, useEffect, useRef } from "react"
import { Search, User, Phone, Calendar, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchExistingPatients } from "../actions"

type SearchResult = Awaited<ReturnType<typeof searchExistingPatients>>[0]

interface Props {
  onSelect: (patient: SearchResult) => void
}

export function ExistingPatientSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const data = await searchExistingPatients(query)
      setResults(data)
      setShowDropdown(true)
      setLoading(false)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(patient: SearchResult) {
    onSelect(patient)
    setQuery("")
    setShowDropdown(false)
  }

  function getDaysSinceVisit(lastVisitDate: Date) {
    const days = Math.floor(
      (new Date().getTime() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (days === 0) return "Today"
    if (days === 1) return "1 day ago"
    return `${days} days ago`
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search existing patient (ID, phone)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          className="pl-9 pr-8 text-sm bg-white w-64"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.map(patient => (
            <button
              key={patient.id}
              onClick={() => handleSelect(patient)}
              className="w-full px-3 py-2.5 text-left hover:bg-surface transition-colors border-b border-border last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {patient.patientId}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {patient.fullName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </span>
                    <span>{patient.age ? `${patient.age}Y` : ""} {patient.gender}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Last visit</span>
                  </div>
                  <p className="text-xs font-medium text-foreground mt-0.5">
                    {getDaysSinceVisit(patient.lastVisitDate)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 p-4 text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No patients found</p>
          <p className="text-xs text-muted-foreground mt-0.5">Try a different ID or phone number</p>
        </div>
      )}
    </div>
  )
}
