/**
 * Where an inline code mention's documentation is.
 *
 * A name is looked up in the workspace's target index: the package's own
 * entry points first, then the members of what they export, then the globals
 * its bundles assign, then what other packages document, and finally the
 * declarations inside the package's own sources. The answer is a page or an
 * anchor on one, a list of candidates when several places could be meant, or
 * nothing at all.
 *
 * @module utils/docs-links
 */

import type { DocsEntry, DocsPackage, DocsTargetIndex, MemberHit, SymbolHit } from './docs-targets'
import { relative } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exemptionOf } from './docs-link-values'
import { entryOfFile, packageOfFile, routeExists } from './docs-targets'

/** The prefix the site gives each exported symbol's anchor. */
export const API_ANCHOR_PREFIX = 'api-'

/** What the site puts between a symbol's anchor and one of its properties'. */
export const PROPERTY_ANCHOR_INFIX = '-prop-'

/** What a code span turned out to be. */
export type CodeMention = ExemptMention | ResolvedMention | AmbiguousMention | ElsewhereMention | UnknownMention

/** The span is a value or syntax, not a name; nothing to link. */
export interface ExemptMention {
  /** The kind discriminator. */
  kind: 'exempt'
  /** Why it is exempt, for tests and messages. */
  reason: string
}

/** The span names something with one documented home. */
export interface ResolvedMention {
  /** The kind discriminator. */
  kind: 'resolved'
  /** What kind of thing it names. */
  target: 'package' | 'entry' | 'symbol' | 'member' | 'global' | 'declaration'
  /** The full URL of that home. */
  url: string
  /** The name the URL documents, when it differs from the span (a member's parent, say). */
  via?: string
}

/** The span names something documented in more than one place. */
export interface AmbiguousMention {
  /** The kind discriminator. */
  kind: 'ambiguous'
  /** The URLs it might mean, each labelled. */
  candidates: readonly string[]
}

/** The span names nothing in its own package, but another package documents a name like it. */
export interface ElsewhereMention {
  /** The kind discriminator. */
  kind: 'elsewhere'
  /** The URLs it might mean, each labelled with the package. */
  candidates: readonly string[]
}

/** The span looks like a name but nothing in the workspace declares it. */
export interface UnknownMention {
  /** The kind discriminator. */
  kind: 'unknown'
}

/** Where the resolver publishes to and reads from. */
export interface LinkOrigins {
  /** Origin of the documentation site, without a trailing slash. */
  siteUrl: string
  /** Browsable repository URL, without a trailing slash; empty when the workspace declares none. */
  repoUrl: string
}

/**
 * The URL of an entry's page.
 *
 * @param origins - Where the site is.
 * @param entry - The entry whose page is wanted.
 * @returns The absolute URL, with a trailing slash.
 */
function entryUrl(origins: LinkOrigins, entry: DocsEntry): string {
  return `${origins.siteUrl}${entry.route}`
}

/**
 * The URL of a symbol's anchor.
 *
 * A symbol exported by exactly one entry is anchored on that entry's page. A
 * symbol several entries of one package export (a root that re-exports a
 * deeper entry, or a browser and a node twin) is anchored on the deepest
 * entry when there is one deepest, and otherwise on the package's landing
 * page, whose reference lists every entry and opens the one holding the
 * symbol.
 *
 * @param origins - Where the site is.
 * @param pkg - The package exporting the symbol.
 * @param hits - Every entry of that package exporting it.
 * @param name - The exported name the anchor is built from.
 * @returns The absolute URL, anchor included.
 */
function symbolUrl(origins: LinkOrigins, pkg: DocsPackage, hits: readonly SymbolHit[], name: string): string {
  const depth = (entry: DocsEntry): number => (entry.subpath === '' ? 0 : entry.subpath.split('/').length)
  const deepest = hits.reduce((best, hit) => (depth(hit.entry) > depth(best.entry) ? hit : best), hits[0] as SymbolHit)
  const atDepth = hits.filter((hit) => depth(hit.entry) === depth(deepest.entry))
  const route = atDepth.length === 1 ? deepest.entry.route : pkg.route
  return `${origins.siteUrl}${route}#${API_ANCHOR_PREFIX}${name}`
}

/** The hits of one package, kept together. */
interface PackageGroup<T extends SymbolHit> {
  /** The package. */
  pkg: DocsPackage
  /** Its hits, in order. */
  hits: T[]
}

/**
 * Groups hits by the package they belong to.
 *
 * @param hits - Symbol or member hits.
 * @returns One group per package, in first-seen order.
 */
function byPackage<T extends SymbolHit>(hits: readonly T[]): Array<PackageGroup<T>> {
  const groups: Array<PackageGroup<T>> = []
  for (const hit of hits) {
    const group = groups.find((candidate) => candidate.pkg === hit.pkg)
    if (group === undefined) {
      groups.push({ pkg: hit.pkg, hits: [hit] })
    } else {
      group.hits.push(hit)
    }
  }
  return groups
}

/**
 * Resolves a symbol the mentioning package exports itself.
 *
 * @param origins - Where the site is.
 * @param hits - The package's own entries exporting the name.
 * @param name - The exported name looked for.
 * @returns The resolved mention, or null when the package does not export the name.
 */
function resolveOwnSymbol(origins: LinkOrigins, hits: readonly SymbolHit[], name: string): CodeMention | null {
  const first = hits[0]
  return first === undefined ? null : { kind: 'resolved', target: 'symbol', url: symbolUrl(origins, first.pkg, hits, name) }
}

/**
 * Resolves a member name to the exported symbol of the mentioning package
 * that declares it.
 *
 * @param origins - Where the site is.
 * @param allHits - The package's own symbols declaring the member.
 * @returns A resolved or ambiguous mention, or null when nothing in the package declares the member.
 */
function resolveOwnMember(origins: LinkOrigins, allHits: readonly MemberHit[]): CodeMention | null {
  // why: a defaults constant carries the same keys as the interface it satisfies, and the interface is where the keys are explained
  const declared = allHits.filter((hit) => hit.parent.kind !== 'variable')
  const hits = declared.length > 0 ? declared : allHits
  const parents = createSet(hits.map((hit) => hit.parent.name))
  if (parents.size === 0) {
    return null
  }
  const anchorOf = (parent: string): string => {
    const siblings = hits.filter((hit) => hit.parent.name === parent)
    return symbolUrl(origins, (siblings[0] as MemberHit).pkg, siblings, parent)
  }
  if (parents.size === 1) {
    const first = hits[0] as MemberHit
    // why: an interface or class property has an anchor of its own on the site, so the reader lands on the line rather than on the type
    const suffix = first.parent.properties.includes(first.member) ? `${PROPERTY_ANCHOR_INFIX}${first.member}` : ''
    return { kind: 'resolved', target: 'member', url: `${anchorOf(first.parent.name)}${suffix}`, via: first.parent.name }
  }
  return { kind: 'ambiguous', candidates: [...parents].map((parent) => `${parent}: ${anchorOf(parent)}`) }
}

/**
 * Lists where other packages document a name, for a mention the package
 * itself does not explain.
 *
 * A name another package exports is a suggestion rather than an answer: a
 * README that says `cancel` more often means the word than a selector some
 * other package happens to export, so the candidates are offered to the
 * author and never applied.
 *
 * @param origins - Where the site is.
 * @param symbols - Every entry exporting the name, in any package.
 * @param members - Every symbol declaring the name as a member, in any package.
 * @param owner - The package the mentioning file belongs to.
 * @param name - The exported name looked for.
 * @returns The labelled candidates, empty when no other package knows the name.
 */
function candidatesElsewhere(
  origins: LinkOrigins,
  symbols: readonly SymbolHit[],
  members: readonly MemberHit[],
  owner: DocsPackage | null,
  name: string
): string[] {
  const candidates: string[] = []
  for (const group of byPackage(symbols.filter((hit) => hit.pkg !== owner))) {
    candidates.push(`${group.pkg.name}: ${symbolUrl(origins, group.pkg, group.hits, name)}`)
  }
  const foreign = members.filter((hit) => hit.pkg !== owner)
  const declared = foreign.filter((hit) => hit.parent.kind !== 'variable')
  const considered = declared.length > 0 ? declared : foreign
  const parents = createSet(considered.map((hit) => `${hit.pkg.name}\n${hit.parent.name}`))
  for (const key of parents) {
    const [pkgName, parent] = key.split('\n') as [string, string]
    const siblings = considered.filter((hit) => hit.pkg.name === pkgName && hit.parent.name === parent)
    candidates.push(`${parent} (${pkgName}): ${symbolUrl(origins, (siblings[0] as MemberHit).pkg, siblings, parent)}`)
  }
  return candidates
}

/**
 * Resolves a name to a declaration inside the mentioning package's sources.
 *
 * @param index - The target index.
 * @param origins - Where the repository is.
 * @param owner - The package the mentioning file belongs to.
 * @param name - The declared name.
 * @returns A resolved or ambiguous mention, or null when the package declares no such name.
 */
function resolveDeclaration(index: DocsTargetIndex, origins: LinkOrigins, owner: DocsPackage | null, name: string): CodeMention | null {
  const files = origins.repoUrl === '' ? [] : (owner?.declarations.get(name) ?? [])
  if (files.length === 0) {
    return null
  }
  const urls = files.map((file) => `${origins.repoUrl}/blob/main/${relative(index.workspaceRoot, file).split('\\').join('/')}`)
  if (urls.length === 1) {
    return { kind: 'resolved', target: 'declaration', url: urls[0] as string }
  }
  return { kind: 'ambiguous', candidates: urls }
}

/**
 * Resolves a dotted mention whose variable is named after its type.
 *
 * Prose writes `protocol.seal` and `queue.size` for a method or property of
 * the `Protocol` and `Queue` types, and the convention is reliable enough to
 * read: when the head, capitalised, names an exported symbol of the package
 * that declares the next segment as a member, that member is what is meant.
 *
 * @param origins - Where the site is.
 * @param owner - The package the mentioning file belongs to.
 * @param segments - The mention split on its dots.
 * @param isOwn - Whether a hit belongs to the mentioning document's own entry.
 * @param index - The target index.
 * @returns The member's anchor, or null when the convention does not apply.
 */
function resolveNamedVariable(
  origins: LinkOrigins,
  owner: DocsPackage | null,
  segments: readonly string[],
  isOwn: (hit: SymbolHit) => boolean,
  index: DocsTargetIndex
): CodeMention | null {
  const [head, member] = segments
  if (owner === null || head === undefined || member === undefined) {
    return null
  }
  const typeName = `${head.charAt(0).toUpperCase()}${head.slice(1)}`
  const hits = (index.members.get(member) ?? []).filter((hit) => isOwn(hit) && hit.parent.name === typeName)
  return resolveOwnMember(origins, hits)
}

/**
 * Resolves a subpath of the mentioning package to its page.
 *
 * An entry point the manifest exports has a page; so does a module the
 * package documents without exporting on its own, such as a platform-neutral
 * core that two platform entries wrap, and a mention of that module reaches
 * its page the same way.
 *
 * @param index - The target index.
 * @param origins - Where the site is.
 * @param owner - The package the mentioning file belongs to.
 * @param subpath - The subpath without its leading slash.
 * @returns The page, or an exempt mention when the package has no such entry or page.
 */
function resolveSubpath(index: DocsTargetIndex, origins: LinkOrigins, owner: DocsPackage | null, subpath: string): CodeMention {
  if (owner === null) {
    return { kind: 'exempt', reason: 'path' }
  }
  const entry = owner.entries.get(subpath)
  if (entry !== undefined) {
    return { kind: 'resolved', target: 'entry', url: entryUrl(origins, entry) }
  }
  const route = `${owner.route}${subpath}/`
  // why: a leading slash that names no entry and no page is a URL path in a server's or a router's prose, which is a value rather than a name
  return routeExists(index, route)
    ? { kind: 'resolved', target: 'entry', url: `${origins.siteUrl}${route}` }
    : { kind: 'exempt', reason: 'path' }
}

/**
 * Resolves a package or entry mention.
 *
 * @param index - The target index.
 * @param origins - Where the site is.
 * @param text - The mention, `@scope/name` with an optional subpath.
 * @returns The package's or entry's page, or an unknown mention.
 */
function resolvePackage(index: DocsTargetIndex, origins: LinkOrigins, text: string): CodeMention {
  const [scope, name, ...rest] = text.split('/')
  const pkg = name === undefined ? undefined : index.packages.get(`${scope}/${name}`)
  if (pkg === undefined) {
    // why: a scoped name the workspace does not publish is somebody else's package, documented wherever they document it
    return { kind: 'exempt', reason: 'external-package' }
  }
  const subpath = rest.join('/')
  if (subpath === '') {
    return { kind: 'resolved', target: 'package', url: `${origins.siteUrl}${pkg.route}` }
  }
  const resolved = resolveSubpath(index, origins, pkg, subpath)
  // why: a package the workspace publishes has no subpath that is merely a path; one it neither exports nor documents is a mistake
  return resolved.kind === 'exempt' ? { kind: 'unknown' } : resolved
}

/**
 * Says what a code span names and where that is documented.
 *
 * Names are looked up in this order: the package's own exports, its exported
 * symbols' members, the bundle globals its build declares, other packages'
 * exports and members, and finally declarations inside the package's own
 * sources. A dotted name is resolved by its head, and when the head is a
 * variable rather than a symbol, by the member accessed on it.
 *
 * @param index - The target index.
 * @param origins - Where the site and the repository are.
 * @param text - The span's text.
 * @param file - Absolute path of the markdown file mentioning it.
 * @returns What the span is.
 *
 * @example Resolving an exported function
 * ```typescript
 * resolveCodeMention(index, origins, 'createShell', '/repo/libs/features/README.md')
 * // { kind: 'resolved', target: 'symbol', url: 'https://www.hyperfrontend.dev/docs/libraries/features/host/#api-createShell' }
 * ```
 */
export function resolveCodeMention(index: DocsTargetIndex, origins: LinkOrigins, text: string, file: string): CodeMention {
  const exemption = exemptionOf(text)
  if (exemption !== null) {
    return { kind: 'exempt', reason: exemption }
  }
  const owner = packageOfFile(index, file)
  if (text.startsWith('@')) {
    return resolvePackage(index, origins, text)
  }
  if (text.startsWith('/')) {
    return resolveSubpath(index, origins, owner, text.slice(1))
  }
  const segments = text.split('.')
  const head = segments[0] as string
  // why: a dotted mention names a property on a variable, and the variable's name is rarely a type's; the members after it are what the type declares
  const memberNames = segments.length > 1 ? segments.slice(1) : [head]
  const symbolHits = index.symbols.get(head) ?? []
  const memberHits = memberNames.flatMap((member) => index.members.get(member) ?? [])
  // why: a document beside an entry point is about that entry; a name only a sibling entry exports is offered rather than applied, since `status` on a server response is not the `status` event a host README is describing
  const entry = owner === null ? null : entryOfFile(owner, file)
  const isOwn = (hit: SymbolHit): boolean => hit.pkg === owner && (entry === null || hit.entry === entry)
  const isSibling = (hit: SymbolHit): boolean => hit.pkg === owner && !isOwn(hit)

  // why: a multi-word identifier is specific enough to trust across the package's entries; a single lowercase word (`status`, `error`) is not, and stays a suggestion when only a sibling entry knows it
  const inPackage = (hit: SymbolHit): boolean => hit.pkg === owner
  const trusted = /[A-Z_]/.test(head) ? inPackage : isOwn
  const fromOwnSymbol = resolveOwnSymbol(origins, symbolHits.filter(trusted), head)
  if (fromOwnSymbol !== null) {
    return fromOwnSymbol
  }
  const fromNamedVariable = resolveNamedVariable(origins, owner, segments, inPackage, index)
  if (fromNamedVariable !== null) {
    return fromNamedVariable
  }
  for (const member of memberNames) {
    const specific = /[A-Z_]/.test(member) ? inPackage : isOwn
    const fromOwnMember = resolveOwnMember(origins, (index.members.get(member) ?? []).filter(specific))
    if (fromOwnMember !== null) {
      return fromOwnMember
    }
  }
  const globalSubpath = owner?.globals.get(head)
  const globalEntry = globalSubpath === undefined ? undefined : owner?.entries.get(globalSubpath)
  if (globalEntry !== undefined) {
    return { kind: 'resolved', target: 'global', url: entryUrl(origins, globalEntry) }
  }
  const siblings = candidatesElsewhere(origins, symbolHits.filter(isSibling), memberHits.filter(isSibling), null, head)
  const elsewhere = candidatesElsewhere(origins, symbolHits, memberHits, owner, head)
  if (siblings.length > 0 || elsewhere.length > 0) {
    return { kind: 'elsewhere', candidates: [...siblings, ...elsewhere] }
  }
  return resolveDeclaration(index, origins, owner, head) ?? { kind: 'unknown' }
}
