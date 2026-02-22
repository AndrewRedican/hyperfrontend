'use client'

import { useState, useCallback } from 'react'

interface ApiSearchFilterProps {
  onSearch: (query: string) => void
  onFilterChange: (filters: ApiFilterState) => void
  counts: {
    functions: number
    classes: number
    interfaces: number
    types: number
    variables: number
    enums: number
  }
}

export interface ApiFilterState {
  functions: boolean
  classes: boolean
  interfaces: boolean
  types: boolean
  variables: boolean
  enums: boolean
}

const defaultFilters: ApiFilterState = {
  functions: true,
  classes: true,
  interfaces: true,
  types: true,
  variables: true,
  enums: true,
}

/**
 * Search and filter controls for API reference
 * @param props - Component props
 * @param props.onSearch - Callback when search query changes
 * @param props.onFilterChange - Callback when filter state changes
 * @param props.counts - Count of items per category
 */
export function ApiSearchFilter({ onSearch, onFilterChange, counts }: ApiSearchFilterProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ApiFilterState>(defaultFilters)

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)
      onSearch(value)
    },
    [onSearch]
  )

  const handleFilterToggle = useCallback(
    (key: keyof ApiFilterState) => {
      const newFilters = { ...filters, [key]: !filters[key] }
      setFilters(newFilters)
      onFilterChange(newFilters)
    },
    [filters, onFilterChange]
  )

  const handleClearSearch = useCallback(() => {
    setQuery('')
    onSearch('')
  }, [onSearch])

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }, [onFilterChange])

  const allFiltersActive = Object.values(filters).every((v) => v)
  const noFiltersActive = Object.values(filters).every((v) => !v)

  return (
    <div className="mb-6 space-y-3">
      {/* Search input */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder="Search API..."
          className="w-full pl-10 pr-10 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Filter:</span>

        <FilterButton active={filters.functions} onClick={() => handleFilterToggle('functions')} color="blue">
          Functions ({counts.functions})
        </FilterButton>

        <FilterButton active={filters.classes} onClick={() => handleFilterToggle('classes')} color="amber">
          Classes ({counts.classes})
        </FilterButton>

        <FilterButton active={filters.interfaces} onClick={() => handleFilterToggle('interfaces')} color="purple">
          Interfaces ({counts.interfaces})
        </FilterButton>

        <FilterButton active={filters.types} onClick={() => handleFilterToggle('types')} color="teal">
          Types ({counts.types})
        </FilterButton>

        <FilterButton active={filters.variables} onClick={() => handleFilterToggle('variables')} color="green">
          Variables ({counts.variables})
        </FilterButton>

        {counts.enums > 0 && (
          <FilterButton active={filters.enums} onClick={() => handleFilterToggle('enums')} color="orange">
            Enums ({counts.enums})
          </FilterButton>
        )}

        {!allFiltersActive && (
          <button onClick={handleResetFilters} className="text-xs text-primary-600 dark:text-primary-400 hover:underline ml-2">
            Reset filters
          </button>
        )}

        {noFiltersActive && <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">No filters selected - showing all</span>}
      </div>
    </div>
  )
}

interface FilterButtonProps {
  active: boolean
  onClick: () => void
  color: 'blue' | 'amber' | 'purple' | 'teal' | 'green' | 'orange'
  children: React.ReactNode
}

function FilterButton({ active, onClick, color, children }: FilterButtonProps) {
  const colorClasses = {
    blue: active
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-300 dark:border-blue-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
    amber: active
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-300 dark:border-amber-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
    purple: active
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 border-purple-300 dark:border-purple-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
    teal: active
      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 border-teal-300 dark:border-teal-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
    green: active
      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-300 dark:border-green-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
    orange: active
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-300 dark:border-orange-700'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700',
  }

  return (
    <button onClick={onClick} className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${colorClasses[color]}`}>
      {children}
    </button>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export { defaultFilters }
