'use client'

import { useState, useMemo } from 'react'
import type { TypeDocOutput, TypeDocNode } from './types'
import { ReflectionKind } from './types'
import { FunctionSignature } from './function-signature'
import { TypeDefinition } from './type-definition'

interface ModuleGroupedViewProps {
  data: TypeDocOutput
  searchQuery?: string
}

interface ModuleGroup {
  name: string
  displayName: string
  exports: TypeDocNode[]
}

/**
 * Renders API documentation grouped by module/entry-point
 * Used for libraries with multiple entry points like network-protocol, state-machine, ui-utils
 * @param props - Component props
 * @param props.data - TypeDoc output data to render
 * @param props.searchQuery - Optional search query to filter exports
 */
export function ModuleGroupedView({ data, searchQuery = '' }: ModuleGroupedViewProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  // Group exports by module
  const modules = useMemo(() => {
    if (!data.children) return []

    const groups: ModuleGroup[] = []

    for (const child of data.children) {
      if (child.kind === ReflectionKind.Module && child.children) {
        // This is a module (entry point)
        const exports = child.children.filter((c) => {
          // Filter by search query if provided
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

    // Sort modules alphabetically
    return groups.sort((a, b) => a.name.localeCompare(b.name))
  }, [data, searchQuery])

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleName)) {
        next.delete(moduleName)
      } else {
        next.add(moduleName)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedModules(new Set(modules.map((m) => m.name)))
  }

  const collapseAll = () => {
    setExpandedModules(new Set())
  }

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

          // Categorize exports within the module
          const functions = module.exports.filter((e) => e.kind === ReflectionKind.Function)
          const classes = module.exports.filter((e) => e.kind === ReflectionKind.Class)
          const interfaces = module.exports.filter((e) => e.kind === ReflectionKind.Interface)
          const types = module.exports.filter((e) => e.kind === ReflectionKind.TypeAlias)
          const variables = module.exports.filter((e) => e.kind === ReflectionKind.Variable)

          return (
            <div
              key={module.name}
              className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              id={`module-${module.name.replace(/\//g, '-')}`}
            >
              {/* Module header (clickable) */}
              <button
                onClick={() => toggleModule(module.name)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ChevronIcon expanded={isExpanded} />
                  <div className="text-left">
                    <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{module.displayName}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">import from &quot;{module.name}&quot;</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ExportBadges
                    functions={functions.length}
                    classes={classes.length}
                    interfaces={interfaces.length}
                    types={types.length}
                    variables={variables.length}
                  />
                </div>
              </button>

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
                          <FunctionSignature key={fn.id} node={fn} />
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
                          <TypeDefinition key={cls.id} node={cls} />
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
                          <TypeDefinition key={iface.id} node={iface} />
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
                          <TypeDefinition key={type.id} node={type} />
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
                          <TypeDefinition key={v.id} node={v} />
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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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
}

function ExportBadges({ functions, classes, interfaces, types, variables }: ExportBadgesProps) {
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
