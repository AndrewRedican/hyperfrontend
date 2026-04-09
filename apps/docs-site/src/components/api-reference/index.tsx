'use client'

import type { ApiFilterState } from './api-search-filter'
import type { TypeDocOutput, TypeDocNode } from './types'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { requestAnimationFrame, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ApiSearchFilter, defaultFilters } from './api-search-filter'
import { FunctionSignature } from './function-signature'
import { ModuleGroupedView, hasModules } from './module-grouped-view'
import { TypeDefinition } from './type-definition'
import { ReflectionKind } from './types'

type ViewMode = 'flat' | 'grouped'

interface ApiReferenceProps {
  data: TypeDocOutput
}

/**
 * Scrolls to an element matching the URL hash, if present.
 * Handles initial page load hash navigation.
 */
function scrollToHash() {
  const hash = window.location.hash
  if (hash) {
    requestAnimationFrame(() => {
      const element = document.querySelector(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        element.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2')
        }, 2000)
      }
    })
  }
}

export function ApiReference({ data }: ApiReferenceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<ApiFilterState>(defaultFilters)
  const [initialHash, setInitialHash] = useState('')

  const isMultiModule = useMemo(() => hasModules(data), [data])
  const [viewMode, setViewMode] = useState<ViewMode>(isMultiModule ? 'grouped' : 'flat')

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      setInitialHash(hash)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'grouped') return

    scrollToHash()

    const handleHashChange = () => scrollToHash()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [viewMode])

  const allExports = useMemo(() => {
    if (!data.children) return []

    const hasModules = data.children.some((child) => child.kind === ReflectionKind.Module)

    if (hasModules) {
      const exports: Array<TypeDocNode & { sourceModule?: string }> = []
      for (const module of data.children) {
        if (module.kind === ReflectionKind.Module && module.children) {
          for (const child of module.children) {
            exports.push({ ...child, sourceModule: module.name })
          }
        }
      }
      return exports
    }

    return data.children
  }, [data])

  const categorizedExports = useMemo(() => {
    const functions = allExports.filter((child) => child.kind === ReflectionKind.Function)
    const classes = allExports.filter((child) => child.kind === ReflectionKind.Class)
    const interfaces = allExports.filter((child) => child.kind === ReflectionKind.Interface)
    const typeAliases = allExports.filter((child) => child.kind === ReflectionKind.TypeAlias)
    const variables = allExports.filter((child) => child.kind === ReflectionKind.Variable)
    const enums = allExports.filter((child) => child.kind === ReflectionKind.Enum)

    const sortByName = (a: TypeDocNode, b: TypeDocNode) => a.name.localeCompare(b.name)

    return {
      functions: functions.sort(sortByName),
      classes: classes.sort(sortByName),
      interfaces: interfaces.sort(sortByName),
      typeAliases: typeAliases.sort(sortByName),
      variables: variables.sort(sortByName),
      enums: enums.sort(sortByName),
    }
  }, [allExports])

  const filterBySearch = useCallback(
    (items: TypeDocNode[]) => {
      if (!searchQuery.trim()) return items
      const query = searchQuery.toLowerCase()
      return items.filter((item) => item.name.toLowerCase().includes(query))
    },
    [searchQuery]
  )

  const filteredExports = useMemo(() => {
    return {
      functions: filters.functions ? filterBySearch(categorizedExports.functions) : [],
      classes: filters.classes ? filterBySearch(categorizedExports.classes) : [],
      interfaces: filters.interfaces ? filterBySearch(categorizedExports.interfaces) : [],
      typeAliases: filters.types ? filterBySearch(categorizedExports.typeAliases) : [],
      variables: filters.variables ? filterBySearch(categorizedExports.variables) : [],
      enums: filters.enums ? filterBySearch(categorizedExports.enums) : [],
    }
  }, [categorizedExports, filters, filterBySearch])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleFilterChange = useCallback((newFilters: ApiFilterState) => {
    setFilters(newFilters)
  }, [])

  if (!allExports.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-400 py-4">No API documentation available for this package.</div>
  }

  const counts = {
    functions: categorizedExports.functions.length,
    classes: categorizedExports.classes.length,
    interfaces: categorizedExports.interfaces.length,
    types: categorizedExports.typeAliases.length,
    variables: categorizedExports.variables.length,
    enums: categorizedExports.enums.length,
  }

  const hasContent =
    filteredExports.functions.length +
      filteredExports.classes.length +
      filteredExports.interfaces.length +
      filteredExports.typeAliases.length +
      filteredExports.variables.length +
      filteredExports.enums.length >
    0

  const isFiltered = searchQuery.trim() !== '' || values(filters).some((v) => !v)

  if (isMultiModule && viewMode === 'grouped') {
    return (
      <div className="api-reference">
        {/* View mode toggle */}
        <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />

        {/* Search input for grouped view */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API..."
            className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <ModuleGroupedView data={data} searchQuery={searchQuery} initialHash={initialHash} />
      </div>
    )
  }

  return (
    <div className="api-reference">
      {/* View mode toggle for multi-module libraries */}
      {isMultiModule && <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />}

      {/* Search and filter controls */}
      <ApiSearchFilter onSearch={handleSearch} onFilterChange={handleFilterChange} counts={counts} />

      {!hasContent && isFiltered && (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
          No results match your search. Try adjusting your filters or search query.
        </div>
      )}

      {!hasContent && !isFiltered && (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4">No exported API documentation available for this package.</div>
      )}

      {/* Quick navigation */}
      {hasContent && (
        <nav className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Contents</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {filteredExports.functions.length > 0 && (
              <a href="#api-functions" className="text-primary-600 hover:underline dark:text-primary-400">
                Functions ({filteredExports.functions.length})
              </a>
            )}
            {filteredExports.classes.length > 0 && (
              <a href="#api-classes" className="text-primary-600 hover:underline dark:text-primary-400">
                Classes ({filteredExports.classes.length})
              </a>
            )}
            {filteredExports.interfaces.length > 0 && (
              <a href="#api-interfaces" className="text-primary-600 hover:underline dark:text-primary-400">
                Interfaces ({filteredExports.interfaces.length})
              </a>
            )}
            {filteredExports.typeAliases.length > 0 && (
              <a href="#api-types" className="text-primary-600 hover:underline dark:text-primary-400">
                Types ({filteredExports.typeAliases.length})
              </a>
            )}
            {filteredExports.variables.length > 0 && (
              <a href="#api-variables" className="text-primary-600 hover:underline dark:text-primary-400">
                Variables ({filteredExports.variables.length})
              </a>
            )}
            {filteredExports.enums.length > 0 && (
              <a href="#api-enums" className="text-primary-600 hover:underline dark:text-primary-400">
                Enums ({filteredExports.enums.length})
              </a>
            )}
          </div>
        </nav>
      )}

      {/* Functions */}
      {filteredExports.functions.length > 0 && (
        <section id="api-functions" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-blue-500">ƒ</span>
            Functions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.functions.map((fn) => (
              <FunctionSignature key={fn.id} node={fn} />
            ))}
          </div>
        </section>
      )}

      {/* Classes */}
      {filteredExports.classes.length > 0 && (
        <section id="api-classes" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-amber-500">◇</span>
            Classes
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.classes.map((cls) => (
              <TypeDefinition key={cls.id} node={cls} />
            ))}
          </div>
        </section>
      )}

      {/* Interfaces */}
      {filteredExports.interfaces.length > 0 && (
        <section id="api-interfaces" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-purple-500">◈</span>
            Interfaces
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.interfaces.map((iface) => (
              <TypeDefinition key={iface.id} node={iface} />
            ))}
          </div>
        </section>
      )}

      {/* Type Aliases */}
      {filteredExports.typeAliases.length > 0 && (
        <section id="api-types" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-teal-500">◆</span>
            Types
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.typeAliases.map((type) => (
              <TypeDefinition key={type.id} node={type} />
            ))}
          </div>
        </section>
      )}

      {/* Variables/Constants */}
      {filteredExports.variables.length > 0 && (
        <section id="api-variables" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-green-500">●</span>
            Variables
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.variables.map((variable) => (
              <VariableItem key={variable.id} node={variable} />
            ))}
          </div>
        </section>
      )}

      {/* Enums */}
      {filteredExports.enums.length > 0 && (
        <section id="api-enums" className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-orange-500">⬡</span>
            Enums
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredExports.enums.map((enumItem) => (
              <TypeDefinition key={enumItem.id} node={enumItem} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function VariableItem({ node }: { node: TypeDocNode }) {
  return (
    <div className="py-4" id={`api-${node.name}`}>
      <div className="flex items-start gap-2">
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
          const
        </span>
        <code className="font-mono text-base font-semibold text-slate-900 dark:text-white">{node.name}</code>
      </div>
      {node.type && (
        <div className="mt-2 ml-16 text-sm">
          <span className="text-slate-500">Type:</span>{' '}
          <code className="text-emerald-600 dark:text-emerald-400 font-mono">{getTypeString(node.type)}</code>
        </div>
      )}
      {node.defaultValue && (
        <div className="mt-1 ml-16 text-sm">
          <span className="text-slate-500">Value:</span>{' '}
          <code className="text-slate-700 dark:text-slate-300 font-mono">{node.defaultValue}</code>
        </div>
      )}
    </div>
  )
}

function getTypeString(type: TypeDocNode['type']): string {
  if (!type) return 'unknown'
  if (type.type === 'intrinsic' || type.type === 'reference') {
    return type.name || 'unknown'
  }
  if (type.type === 'literal') {
    return String(type.value)
  }
  if (type.type === 'array' && type.elementType) {
    return `${getTypeString(type.elementType)}[]`
  }
  return type.type
}

interface ViewModeToggleProps {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
}

function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => onModeChange('grouped')}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'grouped'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          By Module
        </button>
        <button
          onClick={() => onModeChange('flat')}
          className={`px-3 py-1 text-xs font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
            mode === 'flat'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          Flat List
        </button>
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
        {mode === 'grouped' ? 'Organized by entry point' : 'All exports in one list'}
      </span>
    </div>
  )
}

export { FunctionSignature } from './function-signature'
export { TypeDefinition } from './type-definition'
export { ParameterList } from './parameter-list'
export { ExampleBlock } from './example-block'
export { TypeLink } from './type-link'
export { ModuleGroupedView, hasModules } from './module-grouped-view'
export { CopyButton } from './copy-button'
export { ApiSearchFilter, defaultFilters } from './api-search-filter'
export type { TypeDocOutput, TypeDocNode } from './types'
