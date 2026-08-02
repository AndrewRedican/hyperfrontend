'use client'

import type { ReactNode } from 'react'
import type { TypeLinkResolver } from './type-utils'
import { createContext, useContext, useMemo } from 'react'
import { getExternalTypeHref } from './external-links'

/** Docs location and linkable exports for one hyperfrontend package. */
export interface PackageSymbolLinks {
  /** The package's docs page, with a trailing slash */
  href: string
  /** Exported symbol names that have an `api-<name>` anchor on that page */
  symbols: Record<string, true>
}

/** Package name → docs page and linkable exported symbols. */
export type ApiLinkIndex = Record<string, PackageSymbolLinks>

/** Context value shared by every type renderer under one API reference. */
interface ApiLinkContextValue {
  /** Hyperfrontend packages whose exports can be linked */
  index: ApiLinkIndex
  /** Package the current page documents, for references TypeDoc left unattributed */
  currentPackage?: string
}

const ApiLinkContext = createContext<ApiLinkContextValue>({ index: {} })

/** Props for {@link ApiLinkProvider}. */
export interface ApiLinkProviderProps {
  /** Hyperfrontend packages whose exports can be linked */
  index: ApiLinkIndex
  /** Package the current page documents */
  currentPackage?: string
  /** The API reference subtree that should link its type names */
  children: ReactNode
}

/**
 * Provides the symbol-link index that lets type names in an API reference link
 * to where each type is defined — another entry on the same page, another
 * hyperfrontend package's API reference, or external documentation.
 * @param props - Component props
 * @param props.index - Hyperfrontend packages whose exports can be linked
 * @param props.currentPackage - Package the current page documents
 * @param props.children - The API reference subtree that should link its type names
 * @returns The provider wrapping the given children
 */
export function ApiLinkProvider({ index, currentPackage, children }: ApiLinkProviderProps) {
  const value = useMemo(() => ({ index, currentPackage }), [index, currentPackage])
  return <ApiLinkContext.Provider value={value}>{children}</ApiLinkContext.Provider>
}

/**
 * Resolves link targets for referenced type names: hyperfrontend exports link
 * to their `api-<name>` anchor via the provided index, and platform, language,
 * and Node built-ins link out to their canonical documentation.
 * @returns The resolver used by type renderers to link type names
 */
export function useTypeLinkResolver(): TypeLinkResolver {
  const { index, currentPackage } = useContext(ApiLinkContext)
  return useMemo<TypeLinkResolver>(
    () => (type) => {
      const name = (type.name ?? '').replace(/^globalThis\./, '')
      if (!name) return undefined
      const packageName = type.package ?? (typeof type.target === 'number' ? currentPackage : undefined)
      if (!packageName) return undefined
      const entry = index[packageName]
      if (entry) {
        return entry.symbols[name] ? { href: `${entry.href}#api-${name}` } : undefined
      }
      const external = getExternalTypeHref(packageName, name)
      return external ? { href: external, external: true } : undefined
    },
    [index, currentPackage]
  )
}
