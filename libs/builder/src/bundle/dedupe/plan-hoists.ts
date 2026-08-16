import type { EntryDecl, ModuleKey, OwnerIndex, ParsedEntry } from './attribute-modules'
import type { ModuleResolution } from './extract-chunk'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { collectRefs } from '../dependencies/prune/chunk-graph'
import { baseName } from './attribute-modules'
import { resolveModuleRefs } from './extract-chunk'

/**
 * One parsed entry bundle paired with its declarations grouped by owning module.
 */
export interface EntryInput {
  /** The parsed entry bundle. */
  parsed: ParsedEntry
  /** The entry's attributable declarations grouped by module key. */
  byModule: Map<ModuleKey, EntryDecl[]>
}

/**
 * A module the plan will hoist into a shared chunk.
 */
export interface PlannedModule {
  /** Index of the entry whose copy defines the canonical chunk content and order. */
  canonicalEntryIndex: number
  /** Canonical declarations, in source order, that populate the chunk. */
  decls: EntryDecl[]
  /** Resolved references the chunk must re-import. */
  resolution: ModuleResolution
  /** Indexes of every entry that inlines this module and must be rewritten. */
  consumingEntryIndexes: number[]
}

const invertOwners = (owners: OwnerIndex): Map<ModuleKey, Set<string>> => {
  const byModule = createMap<ModuleKey, Set<string>>()
  for (const [base, moduleKey] of owners.ownerOf) {
    const names = byModule.get(moduleKey) ?? createSet<string>([])
    names.add(base)
    byModule.set(moduleKey, names)
  }
  return byModule
}

const collectAppearances = (entries: EntryInput[]): Map<ModuleKey, number[]> => {
  const appearances = createMap<ModuleKey, number[]>()
  for (const [index, entry] of entries.entries())
    for (const moduleKey of entry.byModule.keys()) {
      const list = appearances.get(moduleKey) ?? []
      list.push(index)
      appearances.set(moduleKey, list)
    }
  return appearances
}

// why: a bare statement (multi-declarator var, enum IIFE, side-effecting init) that names one of the module's symbols cannot be cleanly split out — its symbol would vanish from the chunk; leave the whole module inlined.
const isEntangled = (entries: EntryInput[], indexes: number[], ownedNames: Set<string>): boolean =>
  indexes.some((index) =>
    entries[index].parsed.bareStatements.some((statement) => {
      const refs = createSet<string>([])
      collectRefs(statement, refs)
      return from(refs).some((ref) => ownedNames.has(baseName(ref)))
    })
  )

const pickCanonical = (entries: EntryInput[], moduleKey: ModuleKey, indexes: number[]): number =>
  indexes.reduce((best, index) =>
    (entries[index].byModule.get(moduleKey) ?? []).length > (entries[best].byModule.get(moduleKey) ?? []).length ? index : best
  )

const isConsistentCopy = (canonicalFingerprint: Map<string, string>, order: Map<string, number>, decls: EntryDecl[]): boolean => {
  let previous = -1
  for (const decl of decls) {
    const index = order.get(decl.base)
    // why: a copy that names a declaration absent from the canonical superset, reorders it, or differs structurally (rename-insensitive fingerprint) is not provably the same code.
    if (index === undefined || index <= previous || canonicalFingerprint.get(decl.base) !== decl.fingerprint) return false
    previous = index
  }
  return true
}

const planCandidate = (
  entries: EntryInput[],
  owners: OwnerIndex,
  moduleKey: ModuleKey,
  indexes: number[],
  ownedNames: Set<string>
): PlannedModule | null => {
  if (isEntangled(entries, indexes, ownedNames)) return null
  const canonicalEntryIndex = pickCanonical(entries, moduleKey, indexes)
  const canonicalDecls = entries[canonicalEntryIndex].byModule.get(moduleKey) ?? []
  // why: identity gates on the rename-insensitive fingerprint, but chunk rendering still uses each decl's raw `text` via canonicalDecls.
  const canonicalFingerprint = createMap<string, string>()
  const order = createMap<string, number>()
  for (const [index, decl] of canonicalDecls.entries()) {
    canonicalFingerprint.set(decl.base, decl.fingerprint)
    order.set(decl.base, index)
  }
  for (const index of indexes) if (!isConsistentCopy(canonicalFingerprint, order, entries[index].byModule.get(moduleKey) ?? [])) return null
  const canonical = entries[canonicalEntryIndex].parsed
  const resolution = resolveModuleRefs(canonicalDecls, owners, canonical.importBindings, canonical.declNames, moduleKey)
  if (resolution.unresolved.length > 0) return null
  return { canonicalEntryIndex, decls: canonicalDecls, resolution, consumingEntryIndexes: indexes }
}

const closeOverDependencies = (candidates: Map<ModuleKey, PlannedModule>): Map<ModuleKey, PlannedModule> => {
  let changed = true
  while (changed) {
    changed = false
    for (const [moduleKey, planned] of candidates)
      if (planned.resolution.crossModule.some((ref) => !candidates.has(ref.moduleKey))) {
        candidates.delete(moduleKey)
        changed = true
      }
  }
  return candidates
}

// why: shared chunks load topologically, so an acyclic dependency graph guarantees every chunk is fully evaluated before its dependents — no cross-chunk temporal-dead-zone. Modules in (or feeding) a cycle cannot be ordered safely, so they are peeled off and left inlined.
const keepAcyclic = (candidates: Map<ModuleKey, PlannedModule>): Map<ModuleKey, PlannedModule> => {
  const depsOf = createMap<ModuleKey, ModuleKey[]>()
  for (const [moduleKey, planned] of candidates)
    depsOf.set(
      moduleKey,
      planned.resolution.crossModule.map((ref) => ref.moduleKey)
    )
  const pending = createSet<ModuleKey>(candidates.keys())
  let changed = true
  while (changed) {
    changed = false
    for (const [moduleKey, deps] of depsOf)
      if (pending.has(moduleKey) && deps.every((dep) => !pending.has(dep))) {
        pending.delete(moduleKey)
        changed = true
      }
  }
  for (const moduleKey of pending) candidates.delete(moduleKey)
  return candidates
}

/**
 * Plans which first-party modules can be hoisted into shared chunks.
 *
 * A module qualifies only when it is inlined into at least two entries, is not
 * entangled with a bare statement, presents structurally identical declarations
 * (rename-insensitive) in a consistent order across every copy, references
 * nothing unresolvable, and (after closure and acyclic peeling) depends only
 * on other hoisted modules through a cycle-free graph. Anything failing these is left inlined, so the
 * worst case equals the unmodified output.
 *
 * @param entries - Parsed entries with their per-module attribution.
 * @param owners - First-party ownership index.
 * @returns Map from module key to its hoist plan.
 *
 * @example Planning hoists for a set of entries
 * ```typescript
 * const plan = planHoists(entries, owners)
 * ```
 */
export const planHoists = (entries: EntryInput[], owners: OwnerIndex): Map<ModuleKey, PlannedModule> => {
  const ownedNames = invertOwners(owners)
  const candidates = createMap<ModuleKey, PlannedModule>()
  for (const [moduleKey, indexes] of collectAppearances(entries)) {
    if (indexes.length < 2) continue
    const planned = planCandidate(entries, owners, moduleKey, indexes, ownedNames.get(moduleKey) ?? createSet<string>([]))
    if (planned) candidates.set(moduleKey, planned)
  }
  return keepAcyclic(closeOverDependencies(candidates))
}
