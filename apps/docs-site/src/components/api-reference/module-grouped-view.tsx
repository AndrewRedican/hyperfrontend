'use client'

import type { TypeDocOutput, TypeDocNode } from './types'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { requestAnimationFrame, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { CopyButton } from './copy-button'
import { FunctionSignature } from './function-signature'
import { HighlightMatch } from './highlight-match'
import { TypeDefinition } from './type-definition'
import { buildNodeLookup, resolveReference } from './type-utils'
import { ReflectionKind } from './types'

interface ModuleGroupedViewProps {
  data: TypeDocOutput
  searchQuery?: string
  initialHash?: string
}

interface ModuleGroup {
  name: string
  displayName: string
  exports: TypeDocNode[]
}

/**
 * Computes the full import path for a module
 * @param packageName - The root package name (e.g., '@hyperfrontend/ui-utils')
 * @param moduleName - The module subpath (e.g., 'color' or 'index')
 * @returns The full import path (omits '/index' suffix)
 */
function getFullImportPath(packageName: string, moduleName: string): string {
  if (moduleName === 'index') {
    return packageName
  }
  return `${packageName}/${moduleName}`
}

/**
 * Renders API documentation grouped by module/entry-point
 * Used for libraries with multiple entry points like network-protocol, state-machine, ui-utils
 * @param props - Component props
 * @param props.data - TypeDoc output data to render
 * @param props.searchQuery - Optional search query to filter exports
 * @param props.initialHash - Optional URL hash to auto-expand module and scroll to element
 */
export function ModuleGroupedView({ data, searchQuery = '', initialHash }: ModuleGroupedViewProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(createSet())

  const nodeLookup = useMemo(() => buildNodeLookup(data), [data])

  const modules = useMemo(() => {
    if (!data.children) return []

    const groups: ModuleGroup[] = []

    for (const child of data.children) {
      if (child.kind === ReflectionKind.Module && child.children) {
        const exports = child.children
          .map((c) => resolveReference(c, nodeLookup))
          .filter((c) => {
            if (searchQuery) {
              return c.name.toLowerCase().includes(searchQuery.toLowerCase())
            }
            return true
          })

        if (exports.length > 0) {
          groups.push({
            name: child.name,
            displayName: formatModuleName(child.name),
            exports,
          })
        }
      }
    }

    return groups.sort((a, b) => a.name.localeCompare(b.name))
  }, [data, searchQuery, nodeLookup])

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => {
      const next = createSet(prev)
      if (next.has(moduleName)) {
        next.delete(moduleName)
      } else {
        next.add(moduleName)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedModules(createSet(modules.map((m) => m.name)))
  }

  const collapseAll = () => {
    setExpandedModules(createSet())
  }

  /**
   * Scrolls to an element and highlights it temporarily
   */
  const scrollToElement = useCallback((hash: string) => {
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
  }, [])

  useEffect(() => {
    if (!initialHash) return

    const match = initialHash.match(/^#api-([^-]+)/)
    if (!match) return

    const targetName = match[1]

    for (const module of modules) {
      const hasTarget = module.exports.some((exp) => exp.name === targetName)
      if (hasTarget) {
        setExpandedModules((prev) => {
          const next = createSet(prev)
          next.add(module.name)
          return next
        })

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToElement(initialHash)
          })
        })
        break
      }
    }
  }, [initialHash, modules, scrollToElement])

  const prevSearchQuery = useRef(searchQuery)

  useEffect(() => {
    if (searchQuery && searchQuery !== prevSearchQuery.current) {
      const matchingModules = modules.filter((m) => m.exports.length > 0).map((m) => m.name)
      setExpandedModules(createSet(matchingModules))
    }
    prevSearchQuery.current = searchQuery
  }, [searchQuery, modules])

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (!hash) return

      const element = document.querySelector(hash)
      if (element) {
        scrollToElement(hash)
        return
      }

      const match = hash.match(/^#api-([^-]+)/)
      if (!match) return

      const targetName = match[1]

      for (const module of modules) {
        const hasTarget = module.exports.some((exp) => exp.name === targetName)
        if (hasTarget) {
          setExpandedModules((prev) => {
            const next = createSet(prev)
            next.add(module.name)
            return next
          })

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToElement(hash)
            })
          })
          break
        }
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [modules, scrollToElement])

  if (modules.length === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400 py-4">No modules found in this package.</div>
  }

  const totalExports = modules.reduce((sum, m) => sum + m.exports.length, 0)
  const allExpanded = expandedModules.size === modules.length
  const noneExpanded = expandedModules.size === 0

  return (
    <div className="module-grouped-view">
      {/* Module overview */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Module Structure</h3>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              disabled={allExpanded}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Expand all
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={collapseAll}
              disabled={noneExpanded}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Collapse all
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {modules.length} modules · {totalExports} total exports
        </p>
      </div>

      {/* Module list */}
      <div className="space-y-4">
        {modules.map((module) => {
          const isExpanded = expandedModules.has(module.name)

          const functions = module.exports.filter((e) => e.kind === ReflectionKind.Function)
          const classes = module.exports.filter((e) => e.kind === ReflectionKind.Class)
          const interfaces = module.exports.filter((e) => e.kind === ReflectionKind.Interface)
          const types = module.exports.filter((e) => e.kind === ReflectionKind.TypeAlias)
          const variables = module.exports.filter((e) => e.kind === ReflectionKind.Variable)
          const namespaces = module.exports.filter((e) => e.kind === ReflectionKind.Namespace)

          return (
            <div
              key={module.name}
              className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              id={`module-${module.name.replace(/\//g, '-')}`}
            >
              {/* Module header (clickable) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleModule(module.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleModule(module.name)
                  }
                }}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ChevronIcon expanded={isExpanded} />
                  <div className="text-left">
                    <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{module.displayName}</h4>
                    <div
                      className="flex items-center gap-2 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <code className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {getFullImportPath(data.name, module.name)}
                      </code>
                      <CopyButton text={getFullImportPath(data.name, module.name)} size="sm" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ExportBadges
                    functions={functions.length}
                    classes={classes.length}
                    interfaces={interfaces.length}
                    types={types.length}
                    variables={variables.length}
                    namespaces={namespaces.length}
                  />
                </div>
              </div>

              {/* Module contents (collapsible) */}
              {isExpanded && (
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                  {functions.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-blue-500">ƒ</span> Functions
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {functions.map((fn) => (
                          <FunctionSignature key={fn.id} node={fn} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}

                  {classes.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-amber-500">◇</span> Classes
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {classes.map((cls) => (
                          <TypeDefinition key={cls.id} node={cls} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}

                  {interfaces.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-purple-500">◈</span> Interfaces
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {interfaces.map((iface) => (
                          <TypeDefinition key={iface.id} node={iface} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}

                  {types.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-teal-500">◆</span> Types
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {types.map((type) => (
                          <TypeDefinition key={type.id} node={type} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}

                  {variables.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-green-500">●</span> Variables
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {variables.map((v) => (
                          <TypeDefinition key={v.id} node={v} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}

                  {namespaces.length > 0 && (
                    <div className="mb-6 last:mb-0">
                      <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <span className="text-orange-500">⧫</span> Namespaces
                      </h5>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {namespaces.map((ns) => (
                          <NamespaceSection key={ns.id} node={ns} searchQuery={searchQuery} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Format a module name like "browser/channel" to "Browser Channel"
 * @param name - The module name to format
 */
function formatModuleName(name: string): string {
  return name
    .split('/')
    .map((part) =>
      part
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .join(' / ')
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

interface ExportBadgesProps {
  functions: number
  classes: number
  interfaces: number
  types: number
  variables: number
  namespaces: number
}

function ExportBadges({ functions, classes, interfaces, types, variables, namespaces }: ExportBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {functions > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
          {functions} fn
        </span>
      )}
      {classes > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          {classes} cls
        </span>
      )}
      {interfaces > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400">
          {interfaces} int
        </span>
      )}
      {types > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400">{types} type</span>
      )}
      {variables > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
          {variables} var
        </span>
      )}
      {namespaces > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
          {namespaces} ns
        </span>
      )}
    </div>
  )
}

interface NamespaceSectionProps {
  node: TypeDocNode
  searchQuery?: string
}

/**
 * Renders a namespace with its children collapsed by default.
 * Namespaces are created by `export * as name from './module'` patterns.
 * @param root0
 * @param root0.node
 * @param root0.searchQuery
 */
function NamespaceSection({ node, searchQuery = '' }: NamespaceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const childCount = node.children?.length ?? 0

  return (
    <div className="py-3 first:pt-0" id={`api-${node.name}`}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between text-left group">
        <div className="flex items-center gap-2">
          <ChevronIcon expanded={isExpanded} />
          <code className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
            <HighlightMatch text={node.name} query={searchQuery} />
          </code>
          <span className="text-xs text-slate-500 dark:text-slate-400">({childCount} exports)</span>
        </div>
      </button>

      {isExpanded && node.children && (
        <div className="mt-3 ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          {node.children.map((child) => {
            if (child.kind === ReflectionKind.Function) {
              return <FunctionSignature key={child.id} node={child} searchQuery={searchQuery} />
            }
            return <TypeDefinition key={child.id} node={child} searchQuery={searchQuery} />
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Check if a TypeDoc output has modules (multiple entry points)
 * @param data - TypeDoc output data to check
 */
export function hasModules(data: TypeDocOutput): boolean {
  if (!data.children) return false
  return data.children.some((child) => child.kind === ReflectionKind.Module)
}
