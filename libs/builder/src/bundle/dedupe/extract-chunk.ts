import type { ChunkFormat } from '../dependencies/prune/used-exports'
import type { EntryDecl, ImportBinding, ModuleKey, OwnerIndex } from './attribute-modules'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { collectRefs } from '../dependencies/prune/chunk-graph'
import { baseName } from './attribute-modules'

/**
 * A reference from a module's declarations into another first-party module's
 * hoisted chunk.
 */
export interface CrossRef {
  /** Local identifier as written in this module's code (may carry a `$N` suffix). */
  ref: string
  /** The referenced symbol's base name: the name the target chunk exports. */
  base: string
  /** Owning module key of the referenced symbol. */
  moduleKey: ModuleKey
}

/**
 * A reference from a module's declarations into a dependency import the entry
 * already carries.
 */
export interface DepRef {
  /** Local identifier as written in this module's code. */
  ref: string
  /** The entry's binding shape for that identifier. */
  binding: ImportBinding
}

/**
 * Raw classification of every free identifier a module's declarations reference.
 */
export interface ModuleResolution {
  /** References into other first-party modules. */
  crossModule: CrossRef[]
  /** References into dependency imports the entry carries. */
  depImports: DepRef[]
  /** References that name an inlined, unattributable top-level entry binding: a hard blocker. */
  unresolved: string[]
}

/** A cross-module import edge resolved to a concrete chunk specifier. */
export interface CrossImport {
  /** Local binding name in the emitted chunk. */
  ref: string
  /** Exported name on the target chunk. */
  exported: string
  /** Module specifier reaching the target chunk from this chunk. */
  specifier: string
}

/** A dependency import edge resolved to a concrete (chunk-relative) specifier. */
export interface DepImport {
  /** Local binding name in the emitted chunk. */
  ref: string
  /** Binding shape governing how the import is re-emitted. */
  kind: ImportBinding['kind']
  /** Exported name for `named`/`cjs-named` bindings. */
  imported?: string
  /** Chunk-relative module specifier reaching the dependency. */
  specifier: string
}

/** Everything needed to render a single module's hoisted chunk. */
export interface ChunkPlan {
  /** The module's declarations in canonical source order. */
  decls: EntryDecl[]
  /** Resolved cross-module import edges. */
  crossImports: CrossImport[]
  /** Resolved dependency import edges. */
  depImports: DepImport[]
}

/**
 * Classifies every free identifier referenced by a module's declarations,
 * partitioning them into cross-module edges, dependency edges, and hard
 * blockers.
 *
 * Identifiers the module declares itself are intra-chunk and ignored. A name
 * that is neither owned, nor a dependency binding, nor a top-level entry
 * declaration is a runtime global and needs no import. Cross-module references
 * are always safe to lift because {@link planHoists} only keeps an acyclic
 * subset, so every dependency chunk is fully evaluated before its dependent.
 *
 * @param decls - The module's canonical declarations.
 * @param owners - First-party ownership index.
 * @param importBindings - The consuming entry's import bindings.
 * @param entryDeclNames - Every top-level declaration name in the entry.
 * @param selfModuleKey - The module being resolved.
 * @returns The reference resolution.
 *
 * @example Resolving a module's references
 * ```typescript
 * const resolution = resolveModuleRefs(decls, owners, parsed.importBindings, parsed.declNames, 'events/events')
 * ```
 */
export const resolveModuleRefs = (
  decls: EntryDecl[],
  owners: OwnerIndex,
  importBindings: Map<string, ImportBinding>,
  entryDeclNames: Set<string>,
  selfModuleKey: ModuleKey
): ModuleResolution => {
  const selfLocals = createSet(decls.map((decl) => decl.localName))
  const allRefs = createSet<string>([])
  for (const decl of decls) collectRefs(decl.statement, allRefs)
  const crossModule: CrossRef[] = []
  const depImports: DepRef[] = []
  const unresolved: string[] = []
  for (const ref of allRefs) {
    if (selfLocals.has(ref)) continue
    const base = baseName(ref)
    const owner = owners.ownerOf.get(base)
    if (owner !== undefined) {
      if (owner !== selfModuleKey) crossModule.push({ ref, base, moduleKey: owner })
      continue
    }
    const binding = importBindings.get(ref)
    if (binding !== undefined) {
      depImports.push({ ref, binding })
      continue
    }
    if (entryDeclNames.has(ref)) unresolved.push(ref)
  }
  return { crossModule, depImports, unresolved }
}

const namedBinding = (local: string, imported: string): string => (imported === local ? local : `${imported} as ${local}`)
const cjsBinding = (local: string, imported: string): string => (imported === local ? local : `${imported}: ${local}`)

const groupBySpecifier = <T>(items: T[], specifierOf: (item: T) => string): Array<[string, T[]]> => {
  const groups = createMap<string, T[]>()
  for (const item of items) {
    const group = groups.get(specifierOf(item)) ?? []
    group.push(item)
    groups.set(specifierOf(item), group)
  }
  return from(groups.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
}

const renderEsmImports = (crossImports: CrossImport[], depImports: DepImport[]): string[] => {
  const lines: string[] = []
  for (const [specifier, group] of groupBySpecifier(crossImports, (c) => c.specifier))
    lines.push(`import { ${group.map((c) => namedBinding(c.ref, c.exported)).join(', ')} } from '${specifier}';`)
  for (const dep of depImports.filter((d) => d.kind === 'namespace')) lines.push(`import * as ${dep.ref} from '${dep.specifier}';`)
  for (const dep of depImports.filter((d) => d.kind === 'default')) lines.push(`import ${dep.ref} from '${dep.specifier}';`)
  for (const [specifier, group] of groupBySpecifier(
    depImports.filter((d) => d.kind === 'named'),
    (d) => d.specifier
  ))
    lines.push(`import { ${group.map((d) => namedBinding(d.ref, d.imported ?? d.ref)).join(', ')} } from '${specifier}';`)
  return lines
}

const renderCjsRequires = (crossImports: CrossImport[], depImports: DepImport[]): string[] => {
  const lines: string[] = []
  for (const [specifier, group] of groupBySpecifier(crossImports, (c) => c.specifier))
    lines.push(`const { ${group.map((c) => cjsBinding(c.ref, c.exported)).join(', ')} } = require('${specifier}');`)
  for (const dep of depImports.filter((d) => d.kind === 'cjs-namespace')) lines.push(`const ${dep.ref} = require('${dep.specifier}');`)
  for (const [specifier, group] of groupBySpecifier(
    depImports.filter((d) => d.kind === 'cjs-named'),
    (d) => d.specifier
  ))
    lines.push(`const { ${group.map((d) => cjsBinding(d.ref, d.imported ?? d.ref)).join(', ')} } = require('${specifier}');`)
  return lines
}

const renderEsmExports = (decls: EntryDecl[]): string =>
  `export { ${decls.map((decl) => (decl.localName === decl.base ? decl.base : `${decl.localName} as ${decl.base}`)).join(', ')} };`

const renderCjsExports = (decls: EntryDecl[]): string => decls.map((decl) => `exports.${decl.base} = ${decl.localName};`).join('\n')

/**
 * Renders a hoisted module chunk: its resolved imports, the union of its
 * declarations, and an export surface naming each declaration by its base name.
 *
 * @param plan - The module's declarations plus resolved import edges.
 * @param format - Output module format.
 * @returns The chunk source text.
 *
 * @example Rendering an ESM chunk
 * ```typescript
 * const source = renderChunk({ decls, crossImports: [], depImports: [] }, 'esm')
 * ```
 */
export const renderChunk = (plan: ChunkPlan, format: ChunkFormat): string => {
  const body = plan.decls.map((decl) => decl.text).join('\n')
  if (format === 'esm') {
    const imports = renderEsmImports(plan.crossImports, plan.depImports)
    const blocks = imports.length > 0 ? [imports.join('\n'), body, renderEsmExports(plan.decls)] : [body, renderEsmExports(plan.decls)]
    return `${blocks.join('\n\n')}\n`
  }
  const requires = renderCjsRequires(plan.crossImports, plan.depImports)
  const blocks =
    requires.length > 0
      ? ["'use strict';", requires.join('\n'), body, renderCjsExports(plan.decls)]
      : ["'use strict';", body, renderCjsExports(plan.decls)]
  return `${blocks.join('\n\n')}\n`
}
