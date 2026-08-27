import type { NavItem } from './navigation'
import { describe, expect, it } from 'vitest'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { docsNavigation, getNavIconKind, mainNavLinks } from './navigation'

/**
 * Walk the whole tree, so an assertion about routes covers nested entries too.
 *
 * @param items - Navigation items to walk
 * @returns Every item in the tree, parents before children
 */
function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])])
}

const LIBRARIES_ENTRY = docsNavigation.find((item) => item.slug === 'Libraries')

describe('docsNavigation', () => {
  it('routes Libraries at the ecosystem index', () => {
    expect(LIBRARIES_ENTRY?.href).toBe('/docs/libraries')
  })

  it('keeps the package subtree under Libraries so it stays expandable', () => {
    expect(LIBRARIES_ENTRY?.children?.length).toBeGreaterThan(0)
  })

  it('carries no second entry for the ecosystem index', () => {
    const claimants = flatten(docsNavigation).filter((item) => item.href === '/docs/libraries')

    expect(claimants.map((item) => item.slug)).toEqual(['Libraries'])
  })

  it('gives each route a single owner, so one entry answers for the active page', () => {
    const routed = flatten(docsNavigation)
      .map((item) => item.href)
      .filter((href): href is string => Boolean(href))

    expect(routed.length).toBe(createSet(routed).size)
  })

  it('reaches every package page from under Libraries', () => {
    const packages = flatten(LIBRARIES_ENTRY?.children ?? []).filter((item) => item.packageName)

    expect(packages.length).toBeGreaterThanOrEqual(20)
    for (const item of packages) {
      expect(item.href).toMatch(/^\/docs\/libraries\//)
    }
  })

  it('leaves an entry without children or a route out of the tree', () => {
    for (const item of flatten(docsNavigation)) {
      expect(Boolean(item.href) || Boolean(item.children?.length)).toBe(true)
    }
  })

  it('keeps the header links clear of the docs tree', () => {
    expect(mainNavLinks.map((link) => link.href)).not.toContain('/docs/libraries')
  })
})

describe('getNavIconKind', () => {
  it('marks an entry carrying a package name as a package', () => {
    expect(getNavIconKind({ slug: 'nexus', packageName: '@hyperfrontend/nexus' }, false)).toBe('package')
  })

  it('marks the reserved architecture entry inside a package', () => {
    expect(getNavIconKind({ slug: 'architecture' }, true)).toBe('architecture')
  })

  it('marks any other entry inside a package as a submodule', () => {
    expect(getNavIconKind({ slug: 'browser' }, true)).toBe('submodule')
  })

  it('leaves a section heading such as Libraries unmarked', () => {
    expect(getNavIconKind(<NavItem>LIBRARIES_ENTRY, false)).toBeNull()
  })
})
