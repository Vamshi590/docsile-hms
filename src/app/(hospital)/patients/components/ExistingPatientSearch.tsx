"use client"

import { useState, useEffect, useRef } from "react"
import { Search, User, Phone, Calendar, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
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

  function getDaysSinceVisit(lastVisitDate: Date | string) {
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
        <div className="absolute top-full left-0 mt-1.5 w-[28rem] max-w-[calc(100vw-2rem)] bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Existing patients</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{results.length} found</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {results.map(patient => (
              <button
                key={patient.id}
                onClick={() => handleSelect(patient)}
                className="group w-full px-3 py-2.5 text-left hover:bg-primary/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-[10px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded tabular-nums">
                        {patient.patientId}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {patient.fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </span>
                      {(patient.age != null || patient.gender) && (
                        <span className="tabular-nums">
                          {patient.age != null ? `${patient.age}y` : ""}
                          {patient.age != null && patient.gender ? " · " : ""}
                          {patient.gender}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                    <Calendar className="h-3 w-3" />
                    {getDaysSinceVisit(patient.lastVisitDate)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 mt-1.5 w-[28rem] max-w-[calc(100vw-2rem)] bg-white border border-border rounded-xl shadow-xl z-50 p-5 text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No patients found</p>
          <p className="text-xs text-muted-foreground mt-0.5">Try a different ID or phone number</p>
        </div>
      )}
    </div>
  )
}
