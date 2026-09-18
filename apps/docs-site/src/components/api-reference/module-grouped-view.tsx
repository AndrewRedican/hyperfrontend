'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { TypeDocOutput, TypeDocNode } from './types'
import { Fragment, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { requestAnimationFrame, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { AnchorLink } from '../anchor-link'
import { CopyButton } from './copy-button'
import { FunctionSignature } from './function-signature'
import { headingTag } from './heading-level'
import { HighlightMatch } from './highlight-match'
import { TypeDefinition } from './type-definition'
import { buildNodeLookup, getModuleDescription, resolveUniqueExports } from './type-utils'
import { ReflectionKind } from './types'

interface ModuleGroupedViewProps {
  data: TypeDocOutput
  searchQuery?: string
  initialHash?: string
}

interface ModuleGroup {
  name: string
  displayName: string
  description: string
  exports: TypeDocNode[]
}

/**
 * Computes the full import path for a module.
 *
 * TypeDoc names each module by its `@module` tag, which is the fully-qualified
 * import specifier (e.g. '@hyperfrontend/ui-utils/color'). Such names are
 * returned as-is to avoid duplicating the package prefix. Bare subpaths (e.g.
 * 'color') are joined onto the package name, and the root module ('index' or a
 * name equal to the package) resolves to the package name alone.
 * @param packageName - The root package name (e.g., '@hyperfrontend/ui-utils')
 * @param moduleName - The module name from TypeDoc (full specifier or subpath)
 * @returns The full import path (omits '/index' suffix)
 */
function getFullImportPath(packageName: string, moduleName: string): string {
  if (moduleName === 'index' || moduleName === packageName) {
    return packageName
  }
  if (moduleName.startsWith(`${packageName}/`)) {
    return moduleName
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
        const exports = resolveUniqueExports(child.children, nodeLookup).filter((c) => {
          if (searchQuery) {
            return c.name.toLowerCase().includes(searchQuery.toLowerCase())
          }
          return true
        })

        if (exports.length > 0) {
          groups.push({
            name: child.name,
            displayName: formatModuleName(child.name),
            description: getModuleDescription(child.comment),
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
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Module Structure</p>
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
          const fullImportPath = getFullImportPath(data.name, module.name)
          const importStatement = `import {} from '${fullImportPath}'`
          const moduleId = `module-${module.name.replace(/\//g, '-')}`

          return (
            <div key={module.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" id={moduleId}>
              {/* why: the disclosure is a real button inside the module's heading, so it is operable without a role of its own and the copy control beside it is not nested inside another control; the bar around them still toggles on a pointer click so the whole row stays a target */}
              <div
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest('button, a')) return
                  toggleModule(module.name)
                }}
                className="w-full px-4 py-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {/* why: the badges and the copy control keep to a column beside the name where the row has room, and step under it as a row of their own where it does not, so the name is never squeezed to a word a line */}
                <div className="min-w-0 flex-1 basis-56">
                  <h3 className="api-module text-slate-900 dark:text-white">
                    <button
                      type="button"
                      onClick={() => toggleModule(module.name)}
                      aria-expanded={isExpanded}
                      aria-controls={`${moduleId}-contents`}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <ChevronIcon expanded={isExpanded} />
                      <ImportPath path={fullImportPath} />
                    </button>
                  </h3>
                  {module.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 ml-7 max-w-lg">{module.description}</p>
                  )}
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <ExportBadges
                    functions={functions.length}
                    classes={classes.length}
                    interfaces={interfaces.length}
                    types={types.length}
                    variables={variables.length}
                    namespaces={namespaces.length}
                  />
                  <CopyButton text={importStatement} size="sm" />
                </div>
              </div>

              {/* why: the contents are in the document whether or not the module is open, hidden rather than absent, so the reference is there for a crawler and for find-in-page and opening a module reveals rather than renders */}
              <div
                id={`${moduleId}-contents`}
                hidden={!isExpanded}
                className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700"
              >
                {functions.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-blue-500">ƒ</span> Functions
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {functions.map((fn) => (
                        <FunctionSignature key={fn.id} node={fn} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}

                {classes.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-amber-500">◇</span> Classes
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {classes.map((cls) => (
                        <TypeDefinition key={cls.id} node={cls} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}

                {interfaces.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-purple-500">◈</span> Interfaces
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {interfaces.map((iface) => (
                        <TypeDefinition key={iface.id} node={iface} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}

                {types.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-teal-500">◆</span> Types
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {types.map((type) => (
                        <TypeDefinition key={type.id} node={type} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}

                {variables.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-green-500">●</span> Variables
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {variables.map((v) => (
                        <TypeDefinition key={v.id} node={v} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}

                {namespaces.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <span className="text-orange-500">⧫</span> Namespaces
                    </h4>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {namespaces.map((ns) => (
                        <NamespaceSection key={ns.id} node={ns} searchQuery={searchQuery} level={5} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

/** Props for {@link ImportPath}. */
interface ImportPathProps {
  /** The full import specifier, e.g. `@hyperfrontend/network-protocol/browser/channel` */
  path: string
}

/**
 * An import path that folds at its own separators.
 *
 * A specifier is one word to the line breaker, so on a narrow screen it would
 * be broken wherever the line happened to end. A break opportunity after each
 * slash lets it fold segment by segment instead, and the segments stay whole.
 * @param props - See {@link ImportPathProps}.
 * @param props.path - The full import specifier
 * @returns The path with a soft break after every separator
 */
function ImportPath({ path }: ImportPathProps) {
  const segments = path.split('/')
  return (
    <span>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <>
              /<wbr />
            </>
          ) : null}
          {segment}
        </Fragment>
      ))}
    </span>
  )
}

type ChevronIconProps = { expanded: boolean }

function ChevronIcon({ expanded }: ChevronIconProps) {
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
  /** Heading level of the namespace's own heading; its members sit one under it */
  level?: ApiHeadingLevel
}

/**
 * Renders a namespace with its children collapsed by default.
 * Namespaces are created by `export * as name from './module'` patterns.
 * @param root0
 * @param root0.node
 * @param root0.searchQuery
 * @param root0.level
 */
function NamespaceSection({ node, searchQuery = '', level = 3 }: NamespaceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Symbol = headingTag(level)
  const contentsId = `api-${node.name}-members`

  const childCount = node.children?.length ?? 0

  return (
    <div className="pt-8 pb-3 first:pt-0" id={`api-${node.name}`}>
      <div className="flex items-center gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        {/* why: the disclosure is a button inside the namespace's heading, so the outline names the namespace and the control that opens it is operable as one */}
        <Symbol className="api-symbol min-w-0 flex-1 text-slate-900 dark:text-white">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={contentsId}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronIcon expanded={isExpanded} />
            <HighlightMatch text={node.name} query={searchQuery} />
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({childCount} exports)</span>
          </button>
        </Symbol>
      </div>

      {isExpanded && node.children && (
        <div id={contentsId} className="mt-3 ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          {node.children.map((child) => {
            if (child.kind === ReflectionKind.Function) {
              return <FunctionSignature key={child.id} node={child} searchQuery={searchQuery} level={level} />
            }
            return <TypeDefinition key={child.id} node={child} searchQuery={searchQuery} level={level} />
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
