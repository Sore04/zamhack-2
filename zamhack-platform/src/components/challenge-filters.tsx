"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react"

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "E-commerce",
  "Design",
  "Marketing",
  "Agriculture",
  "Manufacturing",
  "Social Impact",
  "Other",
]

export function ChallengeFilters() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  const [query, setQuery]                       = useState(searchParams.get("q") || "")
  const [sort, setSort]                         = useState(searchParams.get("sort") || "newest")
  const [difficulty, setDifficulty]             = useState(searchParams.get("difficulty") || "all")
  const [participationType, setParticipationType] = useState(searchParams.get("participation_type") || "all")
  const [entryType, setEntryType]               = useState(searchParams.get("entry_type") || "all")
  const [showFilters, setShowFilters]           = useState(false)

  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(() => {
    const raw = searchParams.get("category")
    return raw ? raw.split(",").filter(Boolean) : []
  })

  const hasActiveFilters =
    !!query ||
    selectedIndustries.length > 0 ||
    sort !== "newest" ||
    difficulty !== "all" ||
    participationType !== "all" ||
    entryType !== "all"

  const activeFilterCount = [
    !!query,
    selectedIndustries.length > 0,
    sort !== "newest",
    difficulty !== "all",
    participationType !== "all",
    entryType !== "all",
  ].filter(Boolean).length

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query) params.set("q", query)
      else params.delete("q")
      replace(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set(key, value)
    else params.delete(key)
    replace(`${pathname}?${params.toString()}`)
  }

const toggleIndustry = (industry: string) => {
  const next = selectedIndustries.includes(industry)
    ? selectedIndustries.filter((i) => i !== industry)
    : [...selectedIndustries, industry]
  setSelectedIndustries(next)

  const params = new URLSearchParams(searchParams.toString())
  params.delete("category")
  const base = params.toString()
  const categoryStr = next.map(encodeURIComponent).join(",")
  const qs = next.length > 0
    ? (base ? base + "&" : "") + "category=" + categoryStr
    : base
  replace(`${pathname}${qs ? "?" + qs : ""}`)
}

  const handleClear = () => {
    setQuery("")
    setSelectedIndustries([])
    setSort("newest")
    setDifficulty("all")
    setParticipationType("all")
    setEntryType("all")
    replace(pathname)
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm md:p-4 md:space-y-4">

      {/* ── Always-visible top bar: search + toggle + clear ─────────── */}
      <div className="flex gap-2">
        {/* Search — takes all remaining width */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search challenges..."
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filter toggle — mobile only */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted md:hidden"
          aria-expanded={showFilters}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
          {showFilters
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />
          }
        </button>

        {/* Clear — only shown when filters are active */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-10 shrink-0 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      {/* ── Collapsible filter body ──────────────────────────────────
          On mobile: hidden until toggle is pressed.
          On md+: always visible (override the mobile hidden state).     */}
      <div className={`space-y-3 md:!block md:space-y-4 ${showFilters ? "block" : "hidden"}`}>
        
       {/*AFTER — all 4 dropdowns in one row*/} 
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Select value={sort} onValueChange={(val) => { setSort(val); handleFilterChange("sort", val) }}>
          <SelectTrigger><SelectValue placeholder="Sort By" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="closing_soon">Closing Soon</SelectItem>
            <SelectItem value="participants_high">Most Popular</SelectItem>
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(val) => { setDifficulty(val); handleFilterChange("difficulty", val) }}>
          <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">🟢 Beginner</SelectItem>
            <SelectItem value="intermediate">🟡 Intermediate</SelectItem>
            <SelectItem value="advanced">🔴 Advanced</SelectItem>
          </SelectContent>
        </Select>

        <Select value={participationType} onValueChange={(val) => { setParticipationType(val); handleFilterChange("participation_type", val) }}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Solo & Team</SelectItem>
            <SelectItem value="solo">👤 Solo</SelectItem>
            <SelectItem value="team">👥 Team</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entryType} onValueChange={(val) => { setEntryType(val); handleFilterChange("entry_type", val) }}>
          <SelectTrigger><SelectValue placeholder="Entry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="free">🆓 Free</SelectItem>
            <SelectItem value="paid">💳 Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

        {/* Industry multi-checkbox */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Industry{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (select all that apply)
            </span>
            {selectedIndustries.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {selectedIndustries.length} selected
              </span>
            )}
          </p>

          <div className="rounded-md border p-3">
            {/*
              Mobile:  2 columns, tight gap
              sm+:     3 columns
            */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 sm:gap-x-6">
              {INDUSTRIES.map((industry) => {
                const id = `industry-${industry}`
                const checked = selectedIndustries.includes(industry)
                return (
                  <div key={industry} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => toggleIndustry(industry)}
                      aria-label={industry}
                    />
                    <Label
                      htmlFor={id}
                      className="cursor-pointer text-sm font-normal leading-none"
                    >
                      {industry}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
