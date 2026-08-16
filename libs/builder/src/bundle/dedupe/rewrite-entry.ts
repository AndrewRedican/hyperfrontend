import type { ChunkFormat } from '../dependencies/prune/used-exports'
import type { EntryDecl, ParsedEntry } from './attribute-modules'
import ts from 'typescript'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from '../dependencies/prune/ast-utils'

/**
 * One module's hoist within a single entry: the declarations to splice out and
 * the chunk specifier the entry should import them from.
 */
export interface EntryHoist {
  /** The module's declarations as they appear in this entry. */
  decls: EntryDecl[]
  /** Chunk-relative module specifier reaching the module's shared chunk. */
  specifier: string
}

/** A single text replacement over the original source. */
interface Edit {
  /** Inclusive start offset. */
  start: number
  /** Exclusive end offset. */
  end: number
  /** Replacement text (empty deletes the span). */
  text: string
}

const esmBinding = (decl: EntryDecl): string => (decl.base === decl.localName ? decl.base : `${decl.base} as ${decl.localName}`)
const cjsBinding = (decl: EntryDecl): string => (decl.base === decl.localName ? decl.base : `${decl.base}: ${decl.localName}`)

const renderImport = (hoist: EntryHoist, format: ChunkFormat): string =>
  format === 'esm'
    ? `import { ${hoist.decls.map(esmBinding).join(', ')} } from '${hoist.specifier}';`
    : `const { ${hoist.decls.map(cjsBinding).join(', ')} } = require('${hoist.specifier}');`

const applyEdits = (source: string, edits: Edit[]): string => {
  let code = source
  for (const edit of from(edits).sort((a, b) => b.start - a.start)) code = `${code.slice(0, edit.start)}${edit.text}${code.slice(edit.end)}`
  // why: splicing whole statements leaves runs of blank lines; collapse them so the trimmed entry stays readable.
  return code.replace(/\n{3,}/g, '\n\n')
}

// why: liveness over-approximates — every identifier node (property names included) counts as a use, so trimming an import can only drop a name nothing references, never one that survives.
const collectIdentifierNames = (source: string): Set<string> => {
  const names = createSet<string>([])
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) names.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(parseChunk(source))
  return names
}

/**
 * Rewrites an entry bundle to consume hoisted modules from `_shared/` chunks
 * instead of inlining them.
 *
 * Splices every hoisted declaration (and its leading comments) out of the entry
 * and prepends an import/`require` binding the chunk's base export to the
 * entry's local name, aliasing when rollup renamed the local (`foo as foo$1`).
 * Only the hoisted symbols the entry still references after splicing are
 * re-imported: a private helper used solely by another hoisted export (e.g. a
 * reducer's `handlers`, used only by the hoisted `rootReducer`) is seen as dead
 * against the spliced body and omitted from the import, while the chunk it lives
 * in keeps it. The bundle's export surface is left untouched: surviving spliced
 * names are now supplied by the inserted imports, so the published API is
 * byte-for-byte identical to before.
 *
 * @param parsed - The parsed entry bundle.
 * @param hoists - The modules hoisted out of this entry, each with its chunk specifier.
 * @param format - Output module format.
 * @returns The rewritten entry source, or the original source when `hoists` is empty.
 *
 * @example Rewriting an entry to import a shared module
 * ```typescript
 * const rewritten = rewriteEntry(parseEntry(source, 'esm'), [{ decls, specifier: './_shared/state/index.esm.js' }], 'esm')
 * ```
 */
export const rewriteEntry = (parsed: ParsedEntry, hoists: EntryHoist[], format: ChunkFormat): string => {
  if (hoists.length === 0) return parsed.sourceFile.text
  const deletions: Edit[] = []
  for (const hoist of hoists)
    for (const decl of hoist.decls) deletions.push({ start: decl.statement.getFullStart(), end: decl.statement.getEnd(), text: '' })
  // why: liveness is measured on the body WITHOUT the hoisted decls (and before re-inserting imports), so a private symbol used only by another hoisted decl (e.g. `handlers`, used only by the hoisted `rootReducer`) is correctly seen as dead and never re-imported.
  const spliced = applyEdits(parsed.sourceFile.text, deletions)
  const live = collectIdentifierNames(spliced)
  const liveHoists = hoists
    .map((hoist) => ({ ...hoist, decls: hoist.decls.filter((decl) => live.has(decl.localName)) }))
    .filter((hoist) => hoist.decls.length > 0)
  if (liveHoists.length === 0) return spliced
  const block = liveHoists.map((hoist) => renderImport(hoist, format)).join('\n')
  const insertion = parsed.headerEnd > 0 ? `\n${block}` : `${block}\n`
  return applyEdits(parsed.sourceFile.text, [...deletions, { start: parsed.headerEnd, end: parsed.headerEnd, text: insertion }])
}
