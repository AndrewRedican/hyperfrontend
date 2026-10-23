/**
 * Where an inline code mention in package documentation is documented. A value, a keyword, a
 * command, a path or a platform name needs no link; a package, an entry point, an exported
 * symbol, a member, a bundle global or a declared name resolves to the page or file explaining
 * it, or to the places other packages document it.
 *
 * @module rules/workspace/shared/docs-mentions
 */

import type { LinkOrigins } from './docs-anchors.ts'
import type { DocsSymbol } from './docs-api.ts'
import type { DocsEntry, DocsIndex, DocsPackage, MemberHit, SymbolHit } from './docs-catalog.ts'
import { posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { declarationsOf, entryOfFile, packageOfFile, routeExists } from './docs-catalog.ts'

/** A mention of code that needs no link. */
export interface ExemptMention {
  /** Marks the mention as needing no link. */
  readonly kind: 'exempt'
}

/** A mention of a name no package, entry or declaration answers to. */
export interface UnknownMention {
  /** Marks the mention as naming nothing the docs know. */
  readonly kind: 'unknown'
}

/** A mention that names one documentation target. */
export interface ResolvedMention {
  /** Marks the mention as resolved. */
  readonly kind: 'resolved'
  /** What it names: a symbol, a member, an entry or a package. */
  readonly target: string
  /** The page and anchor documenting it. */
  readonly url: string
  /** The parent symbol a member is documented under, when it is one. */
  readonly via?: string
}

/** A mention that several targets, or only targets in other packages, answer to. */
export interface UnresolvedMention {
  /** `ambiguous` for several targets, `elsewhere` for targets outside the mentioning package only. */
  readonly kind: 'ambiguous' | 'elsewhere'
  /** Where the targets are documented. */
  readonly candidates: readonly string[]
}

/** The entry of a hit, as far as its route is concerned. */
interface RoutedHit {
  /** The entry the hit is exported from. */
  readonly entry: Pick<DocsEntry, 'subpath' | 'route'>
}

/** What a mention comes to. */
export type CodeMention = ExemptMention | UnknownMention | ResolvedMention | UnresolvedMention

/** The words of the languages and their type system, which are code for what they are. */
const KEYWORDS = createSet(
  `any as async await bigint boolean break case catch class const continue declare default delete do else enum export extends
  false finally for function global if implements import in infer instanceof interface is keyof let module namespace never new null
  number object of readonly require return satisfies string super switch symbol this throw true try type typeof undefined unknown
  var void while yield NaN Infinity`.split(/\s+/)
)

/** The command-line tools a mention may name on their own. */
const COMMANDS = createSet('bash cat cd curl docker git hf ls node npm npx nx pnpm rollup sh tsc vite yarn'.split(' '))

/** The names the platform defines: language built-ins, browser and Node globals, Node modules and elements. */
const PLATFORM = createSet(
  `AbortController AbortSignal AggregateError Array ArrayBuffer Atomics AudioContext BigInt BigInt64Array BigUint64Array Blob
  Boolean BroadcastChannel Buffer CSS CSSStyleSheet CryptoKey CustomEvent DataView Date Document DocumentFragment Element Error
  ErrorEvent EvalError Event EventTarget File FileReader FinalizationRegistry Float32Array Float64Array FormData Function
  HTMLElement HTMLIFrameElement HTMLScriptElement Headers Int16Array Int32Array Int8Array IntersectionObserver Intl Iterator JSON
  Map Math MessageChannel MessageEvent MessagePort MutationObserver Node Number Object OfflineAudioContext PerformanceObserver
  Promise PromiseRejectionEvent Proxy RangeError ReferenceError Reflect RegExp Request ResizeObserver Response ServiceWorker Set
  ShadowRoot SharedArrayBuffer SharedWorker String SubtleCrypto Symbol SyntaxError TextDecoder TextEncoder TypeError URIError URL
  URLSearchParams Uint16Array Uint32Array Uint8Array Uint8ClampedArray WeakMap WeakRef WeakSet WebSocket Window Worker
  XMLHttpRequest Readable Writable Transform Duplex EventEmitter PassThrough __dirname __filename addEventListener appendChild assert atob audio body btoa cancelAnimationFrame canvas child_process
  clearInterval clearTimeout console createElement crypto dispatchEvent div document events exports fetch fs getElementById global globalThis head history html
  http https iframe img indexedDB innerHTML localStorage location matchMedia module navigator net os path performance postMessage process
  querySelector querySelectorAll queueMicrotask removeChild removeEventListener requestAnimationFrame requestIdleCallback require screen script sessionStorage setInterval
  setTimeout span stream structuredClone style subtle textContent timers url util video webcrypto window worker_threads zlib`.split(/\s+/)
)

/** The extensions that make a dotted name a file name. */
const FILE_EXTENSIONS = createSet(
  'cjs css gif htm html js json jsx lock md mjs mp4 mts png svg tgz toml ts tsx txt webp xml yaml yml'.split(' ')
)

/** An identifier, or identifiers joined by dots. */
// lint-disable-next-line no-unsafe-regex -- each repetition starts at a literal dot, so no two repetitions can share a character
const NAME = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/

/** A name written as one lower-case word, which in prose more often means the word. */
const WORD = /^[a-z]+$/

/**
 * Tells whether inline code is a value rather than a name: anything other than a package, a
 * subpath or an identifier path, and among those a single character, a reserved double-underscore
 * name, a keyword, a command, a file name or a name the platform defines.
 *
 * @param text - The inline code
 * @returns True when the mention needs no link
 */
export function exemptionOf(text: string): boolean {
  // lint-disable-next-line no-unsafe-regex -- each repetition starts at a literal slash, which the segments exclude
  if (text.startsWith('@')) return !/^@[\w.-]+(?:\/[\w.-]+)+$/.test(text)
  if (text.startsWith('/')) return text.endsWith('/')
  if (!NAME.test(text) || text.length === 1 || text.startsWith('__')) return true
  const segments = text.split('.')
  if (segments.length === 1) return KEYWORDS.has(text) || COMMANDS.has(text) || PLATFORM.has(text)
  return PLATFORM.has(segments[0] as string) || FILE_EXTENSIONS.has(segments[segments.length - 1] as string)
}

/**
 * Finds the route of the page a package documents a symbol on: the one entry exporting it at the
 * greatest depth, or the landing page when several share that depth.
 *
 * @param pkg - The package
 * @param hits - The symbol's hits within the package
 * @returns The site path of the page documenting the symbol
 */
function symbolRoute(pkg: DocsPackage, hits: readonly RoutedHit[]): string {
  const depth = (subpath: string): number => (subpath === '' ? 0 : subpath.split('/').length)
  const deepest = hits.reduce((most, hit) => (depth(hit.entry.subpath) > most ? depth(hit.entry.subpath) : most), 0)
  const routes = createSet(hits.filter((hit) => depth(hit.entry.subpath) === deepest).map((hit) => hit.entry.route))
  return routes.size === 1 ? ([...routes][0] as string) : pkg.route
}

/**
 * Builds the anchor of a member on its parent's page: its own line for a property or a method
 * the reference anchors, the parent otherwise.
 *
 * @param parent - The symbol carrying the member
 * @param member - A property or method name of the parent
 * @returns The fragment, without the `#`
 */
function memberAnchor(parent: DocsSymbol, member: string): string {
  if (parent.properties.includes(member)) return `api-${parent.name}-prop-${member}`
  return parent.methods.includes(member) ? `api-${parent.name}-method-${member}` : `api-${parent.name}`
}

/**
 * Reduces member hits to their distinct parents, a parent being a symbol of one package, and
 * keeps the declared types among them when values merely mirror one.
 *
 * @param hits - The member's hits
 * @returns The parents, each with its hits
 */
function parentsOf(hits: readonly MemberHit[]): MemberHit[][] {
  const groups = createMap<string, MemberHit[]>()
  for (const hit of hits) {
    const key = `${hit.pkg.name}\u0000${hit.parent.name}`
    groups.set(key, [...(groups.get(key) ?? []), hit])
  }
  const all = [...groups.values()]
  const typed = all.filter((group) => (group[0] as MemberHit).parent.kind !== 'variable')
  return typed.length > 0 ? typed : all
}

/**
 * Resolves the mention of a package or of one of its subpaths.
 *
 * @param pkg - The package
 * @param subpath - The subpath after the package name, empty for the package itself
 * @param siteUrl - The site's origin
 * @param index - The catalogue
 * @returns The mention's destination, or unknown for a subpath with no page
 */
function subpathMention(pkg: DocsPackage, subpath: string, siteUrl: string, index: DocsIndex): CodeMention | null {
  if (subpath === '') return { kind: 'resolved', target: 'package', url: `${siteUrl}${pkg.route}` }
  const route = pkg.entries.get(subpath)?.route ?? `${pkg.route}${subpath}/`
  return pkg.entries.has(subpath) || routeExists(index, route) ? { kind: 'resolved', target: 'entry', url: `${siteUrl}${route}` } : null
}

/**
 * Resolves inline code to where it is documented, from the document it sits in.
 *
 * @param index - The catalogue
 * @param origins - The site and repository the destinations are published under
 * @param text - The inline code
 * @param file - The document
 * @returns What the mention comes to
 */
export function resolveMention(index: DocsIndex, origins: LinkOrigins, text: string, file: string): CodeMention {
  if (exemptionOf(text)) return { kind: 'exempt' }
  const site = origins.siteUrl.replace(/\/+$/, '')
  const home = packageOfFile(index, file)
  if (text.startsWith('@')) {
    const [scope, name, ...rest] = text.split('/')
    const pkg = index.packages.get(`${scope as string}/${name as string}`)
    if (pkg === undefined) return { kind: 'exempt' }
    return subpathMention(pkg, rest.join('/'), site, index) ?? { kind: 'unknown' }
  }
  if (text.startsWith('/')) return (home === null ? null : subpathMention(home, text.slice(1), site, index)) ?? { kind: 'exempt' }
  const [head, ...tail] = text.split('.') as [string, ...string[]]
  const entry = home === null ? null : entryOfFile(home, file)
  // why: a lone lower-case word mentioned beside an entry is that entry's word unless another entry's export is meant, which only the author can say.
  const narrow = (key: string): boolean => entry !== null && WORD.test(key)
  const inHome = <Hit extends SymbolHit | MemberHit>(hits: readonly Hit[] | undefined): Hit[] =>
    (hits ?? []).filter((hit) => hit.pkg === home)
  const homeSymbols = inHome(index.symbols.get(head))
  const ownSymbols = narrow(head) ? homeSymbols.filter((hit) => hit.entry === entry) : homeSymbols
  if (ownSymbols.length > 0) {
    const route = narrow(head) ? (entry?.route as string) : symbolRoute(home as DocsPackage, ownSymbols)
    return { kind: 'resolved', target: 'symbol', url: `${site}${route}#api-${head}` }
  }
  if (tail.length > 0) {
    const typed = inHome(index.symbols.get(`${head.charAt(0).toUpperCase()}${head.slice(1)}`))
    const parent = typed[0]?.symbol
    if (parent !== undefined && parent.members.includes(tail[0] as string)) {
      const url = `${site}${symbolRoute(home as DocsPackage, typed)}#${memberAnchor(parent, tail[0] as string)}`
      return { kind: 'resolved', target: 'member', url, via: parent.name }
    }
  }
  const keys = tail.length > 0 ? tail : [head]
  for (const key of keys) {
    const hits = inHome(index.members.get(key)).filter((hit) => !narrow(key) || hit.entry === entry)
    if (hits.length === 0) continue
    const parents = parentsOf(hits)
    const { parent } = (parents[0] as MemberHit[])[0] as MemberHit
    if (parents.length === 1) {
      return {
        kind: 'resolved',
        target: 'member',
        url: parentUrl(site, parents[0] as MemberHit[], memberAnchor(parent, key)),
        via: parent.name,
      }
    }
    const candidates = parents.map((group) => {
      const name = (group[0] as MemberHit).parent.name
      return `${name}: ${parentUrl(site, group, `api-${name}`)}`
    })
    return { kind: 'ambiguous', candidates }
  }
  const global = home?.globals.get(head)
  if (global !== undefined)
    return { kind: 'resolved', target: 'global', url: `${site}${(home as DocsPackage).route}${global === '' ? '' : `${global}/`}` }
  const candidates = elsewhere(index, home, head, keys, narrow, site)
  if (candidates.length > 0) return { kind: 'elsewhere', candidates }
  const declared = home === null || origins.repoUrl === '' ? [] : [...(declarationsOf(home).get(head) ?? [])].sort()
  const urls = declared.map((path) => `${origins.repoUrl}/blob/main/${relative(index.root, path).split(sep).join(posix.sep)}`)
  if (urls.length === 1) return { kind: 'resolved', target: 'declaration', url: urls[0] as string }
  return urls.length > 1 ? { kind: 'ambiguous', candidates: urls } : { kind: 'unknown' }
}

/**
 * Builds the URL of an anchor on a member's parent, on the page of the entry the parent is
 * documented on among the entries exporting it with that member.
 *
 * @param site - The site's origin
 * @param group - The parent's hits
 * @param anchor - The fragment, without the `#`
 * @returns The page and anchor documenting the parent of the members
 */
function parentUrl(site: string, group: readonly MemberHit[], anchor: string): string {
  return `${site}${symbolRoute((group[0] as MemberHit).pkg, group)}#${anchor}`
}

/**
 * Keeps the hits that fall in one package.
 *
 * @param hits - Hits across the catalogue
 * @param pkg - The package the hits must belong to
 * @returns Its hits
 */
function inPackage<Hit extends SymbolHit | MemberHit>(hits: readonly Hit[] | undefined, pkg: DocsPackage): Hit[] {
  return (hits ?? []).filter((hit) => hit.pkg === pkg)
}

/**
 * Lists the places a mention is documented other than where it could be linked: the home
 * package's other entries for a lone lower-case word, then every other package, symbols before
 * members, one candidate per package for a symbol and one per parent for a member; the declared
 * types win over mirroring values across all the other packages at once.
 *
 * @param index - The catalogue
 * @param home - The package the document belongs to, or null
 * @param head - The mention's first name
 * @param keys - The names its members are looked up by
 * @param narrow - Whether a name is held to the document's own entry
 * @param site - The site's origin
 * @returns The candidates, each a label and a URL
 */
function elsewhere(
  index: DocsIndex,
  home: DocsPackage | null,
  head: string,
  keys: readonly string[],
  narrow: (key: string) => boolean,
  site: string
): string[] {
  const others = [...index.packages.values()].filter((pkg) => pkg !== home)
  const symbolOf = (pkg: DocsPackage): string[] => {
    const hits = inPackage(index.symbols.get(head), pkg)
    return hits.length === 0 ? [] : [`${pkg.name}: ${site}${symbolRoute(pkg, hits)}#api-${head}`]
  }
  const membersOf = (packages: readonly DocsPackage[], wanted: readonly string[]): string[] => {
    const hits = wanted.flatMap((key) => packages.flatMap((pkg) => inPackage(index.members.get(key), pkg)))
    return parentsOf(hits).map((group) => {
      const { pkg, parent } = group[0] as MemberHit
      return `${parent.name} (${pkg.name}): ${parentUrl(site, group, `api-${parent.name}`)}`
    })
  }
  const own = home === null ? [] : [...(narrow(head) ? symbolOf(home) : []), ...membersOf([home], keys.filter(narrow))]
  return [...own, ...others.flatMap(symbolOf), ...membersOf(others, keys)]
}
