"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronsUpDown, Loader2, Plus, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  allowCustom?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  allowCustom = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  function handleSelect(currentValue: string) {
    onValueChange?.(currentValue === value ? "" : currentValue)
    setOpen(false)
  }

  function handleCustom() {
    if (allowCustom && search.trim()) {
      onValueChange?.(search.trim())
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustom()
            }}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && search ? (
                <button
                  onClick={handleCustom}
                  className="text-primary hover:underline text-sm"
                >
                  Add &ldquo;{search}&rdquo;
                </button>
              ) : (
                "No results found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Editable combobox - type in and select from dropdown
interface EditableComboboxProps {
  options: string[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function EditableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Type or select...",
  className,
  disabled = false,
}: EditableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value ?? "")

  React.useEffect(() => {
    setInputValue(value ?? "")
  }, [value])

  const filtered = React.useMemo(() => {
    if (!inputValue) return options.slice(0, 50)
    const q = inputValue.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50)
  }, [options, inputValue])

  function handleInputChange(v: string) {
    setInputValue(v)
    onValueChange?.(v)
    setOpen(true)
  }

  function handleSelect(val: string) {
    setInputValue(val)
    onValueChange?.(val)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-white"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1 max-h-48 overflow-y-auto">
            {filtered.map((option) => (
              <div
                key={option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  inputValue === option && "bg-accent text-accent-foreground"
                )}
              >
                {option}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Grid combobox — dropdown shows options as chip buttons (flex-wrap)
export function GridCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select or type...",
  className,
  disabled = false,
}: EditableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value ?? "")

  React.useEffect(() => {
    setInputValue(value ?? "")
  }, [value])

  const filtered = React.useMemo(() => {
    if (!inputValue) return options
    const q = inputValue.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, inputValue])

  function handleInputChange(v: string) {
    setInputValue(v)
    onValueChange?.(v)
    setOpen(true)
  }

  function handleSelect(val: string) {
    setInputValue(val)
    onValueChange?.(val)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <input
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-9 px-3 text-sm font-semibold border border-input rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 placeholder:font-normal placeholder:text-muted-foreground disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-40 rounded-md border border-border bg-white shadow-lg">
          <div className="p-2 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-3 gap-1">
              {filtered.map((option) => (
                <div
                  key={option}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "px-2 py-2 cursor-pointer text-sm font-semibold text-center border border-border rounded-none hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap",
                    inputValue === option && "bg-primary/10 border-primary text-primary"
                  )}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Advanced fuzzy filter & scoring ──────────────────────────────────────────

function normalize(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim()
}

function scoreMatch(option: string, query: string): number {
  const o = normalize(option)
  const q = normalize(query)
  if (!q) return 0

  // Exact match (ignoring case/extra spaces)
  if (o === q) return 100

  // Starts with query
  if (o.startsWith(q)) return 80

  // Option words start with query
  const oWords = o.split(" ")
  const qWords = q.split(" ")

  // All query words found as word-starts in option
  const allWordsMatch = qWords.every(qw =>
    oWords.some(ow => ow.startsWith(qw))
  )
  if (allWordsMatch) return 60

  // Contains query as substring
  if (o.includes(q)) return 40

  // Any query word found as substring
  const anyWordMatch = qWords.some(qw =>
    oWords.some(ow => ow.includes(qw))
  )
  if (anyWordMatch) return 20

  return 0
}

function isDuplicate(value: string, options: string[]): boolean {
  const n = normalize(value)
  return options.some(o => normalize(o) === n)
}

// Editable combobox with "Add to database" button for new values
interface EditableComboboxWithAddProps {
  options: string[]
  value?: string
  onValueChange?: (value: string) => void
  onAddOption?: (value: string) => Promise<void>
  onSetDefault?: (value: string) => void
  defaultValue?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  autoUpperCase?: boolean
}

export function EditableComboboxWithAdd({
  options,
  value,
  onValueChange,
  onAddOption,
  onSetDefault,
  defaultValue,
  placeholder = "Type or select...",
  className,
  disabled = false,
  autoUpperCase = false,
}: EditableComboboxWithAddProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value ?? "")
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    setInputValue(value ?? "")
  }, [value])

  const filtered = React.useMemo(() => {
    if (!inputValue) return options.slice(0, 50)
    const scored = options
      .map(o => ({ option: o, score: scoreMatch(o, inputValue) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.option.localeCompare(b.option))
    return scored.map(x => x.option).slice(0, 50)
  }, [options, inputValue])

  // Check if the value is genuinely new (not a near-duplicate)
  const isNewValue =
    inputValue.trim() !== "" &&
    !isDuplicate(inputValue.trim(), options)

  function handleInputChange(v: string) {
    const val = autoUpperCase ? v.toUpperCase() : v
    setInputValue(val)
    onValueChange?.(val)
    setOpen(true)
  }

  function handleSelect(val: string) {
    setInputValue(val)
    onValueChange?.(val)
    setOpen(false)
  }

  async function handleAdd() {
    if (!isNewValue || !onAddOption) return
    setAdding(true)
    const val = autoUpperCase ? inputValue.trim().toUpperCase() : inputValue.trim()
    await onAddOption(val)
    setAdding(false)
    setOpen(false)
  }

  const showDropdown = open && (filtered.length > 0 || isNewValue)

  return (
    <PopoverPrimitive.Root open={showDropdown} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("relative w-full", className)}>
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-white focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0 focus:outline-none placeholder:text-gray-300"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement
            if (target.closest("input")) e.preventDefault()
          }}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="z-[200] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
            <div className="p-1 max-h-48 overflow-y-auto">
            {filtered.map((option) => (
              <div
                key={option}
                onMouseDown={(e) => e.preventDefault()}
                className="group flex items-center rounded-sm"
              >
                <div
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex-1 cursor-default select-none flex items-center gap-1.5 px-2 py-1.5 text-sm outline-none rounded-sm hover:bg-accent hover:text-accent-foreground",
                    inputValue === option && "bg-accent text-accent-foreground"
                  )}
                >
                  {option}
                  {defaultValue === option && (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-4 shrink-0">
                      default
                    </span>
                  )}
                </div>
                {onSetDefault && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onClick={(e) => { e.stopPropagation(); onSetDefault(option) }}
                    title={defaultValue === option ? "Remove default" : "Set as default"}
                    className={cn(
                      "p-1 mr-0.5 rounded shrink-0 transition-colors",
                      defaultValue === option
                        ? "text-amber-400 hover:text-amber-300"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground"
                    )}
                  >
                    <Star className="h-3 w-3" fill={defaultValue === option ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            ))}
            {isNewValue && onAddOption && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAdd}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-primary/10",
                  filtered.length > 0 && "mt-1 border-t border-border"
                )}
              >
                {adding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add &ldquo;{autoUpperCase ? inputValue.trim().toUpperCase() : inputValue.trim()}&rdquo; to list
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
