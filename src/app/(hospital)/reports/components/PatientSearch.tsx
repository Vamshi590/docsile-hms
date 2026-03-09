"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Loader2, User, Phone, Calendar, Hash } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchPatients } from "../actions"

type SearchResult = Awaited<ReturnType<typeof searchPatients>>[0]

interface Props {
  onSelect: (patient: SearchResult) => void
  selectedPatientId?: string | null
}

export function PatientSearch({ onSelect, selectedPatientId }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
      const data = await searchPatients(query)
      setResults(data)
      setShowDropdown(true)
      setFocusedIndex(-1)
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[focusedIndex])
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  function getDaysSinceVisit(date: Date) {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 30) return `${days}d ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search by Patient ID, name, or phone number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="h-12 pl-12 pr-12 text-[0.95rem] bg-white border-gray-200 rounded-xl shadow-sm focus:shadow-md focus:border-primary/40 transition-all"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
        )}
        {!loading && selectedPatientId && query === "" && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded-md">
              {selectedPatientId}
            </span>
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-muted-foreground font-medium">{results.length} patient{results.length !== 1 ? "s" : ""} found</span>
          </div>
          {results.map((patient, i) => (
            <button
              key={patient.id}
              onClick={() => handleSelect(patient)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-b-0",
                focusedIndex === i ? "bg-primary/5" : "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                    <User className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {patient.fullName}
                      </span>
                      <span className="text-xs font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {patient.patientId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {patient.age ? `${patient.age}Y` : ""} {patient.gender}
                      </span>
                    </div>
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

      {/* No Results */}
      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mx-auto mb-3">
            <Hash className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No patients found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different Patient ID, name, or phone number</p>
        </div>
      )}
    </div>
  )
}
