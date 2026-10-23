/**
 * An import whose bindings serve only as types is written `import type`, which the compiler
 * erases: a declaration used only as types gets the keyword, and the type-only bindings of a
 * mixed declaration move to a separate `import type` of the same module, joining one that
 * exists. Unless configured otherwise, `import()` type annotations are reported.
 *
 * @module rules/typescript/consistent-type-imports
 */

import type { Node, SourceToken } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { RuleContext } from '../../engine/rule'
import type { Reference, Variable } from '../../scope/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { tokenAfter, tokenBefore, tokensBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'
import { mergeEdits } from './shared/edits'

/** The rule's options. */
export interface ConsistentTypeImportsOptions {
  /** Whether `import()` type annotations are reported; they are unless this is false. */
  readonly disallowTypeAnnotations?: boolean
  /** The preference; type imports are preferred. */
  readonly prefer?: 'type-imports'
  /** How a mixed declaration is fixed; its type-only bindings move to a separate declaration. */
  readonly fixStyle?: 'separate-type-imports'
}

/** The import declarations of one module, as the fixes need them. */
interface ModuleImports {
  /** The first `import type { ... }` of the module, which receives moved bindings, or null. */
  typeOnlyNamedImport: Node | null
  /** The value imports with type-only bindings, in source order. */
  readonly reports: ValueImportReport[]
}

/** A value import declaration with bindings used only as types. */
interface ValueImportReport {
  /** The declaration. */
  readonly node: Node
  /** The specifiers whose bindings are used only as types; at least one. */
  readonly typeSpecifiers: readonly Node[]
  /** The specifiers whose bindings are used as values. */
  readonly valueSpecifiers: readonly Node[]
  /** The specifiers whose bindings are never used. */
  readonly unusedSpecifiers: readonly Node[]
}

/** The specifiers of a declaration by kind. */
interface ClassifiedSpecifiers {
  /** The default import, or null. */
  readonly defaultSpecifier: Node | null
  /** The named imports, in source order. */
  readonly namedSpecifiers: readonly Node[]
  /** The namespace import, or null. */
  readonly namespaceSpecifier: Node | null
}

/** The edits that move named specifiers out of a declaration. */
interface NamedSpecifierEdits {
  /** The removals of the moved specifiers from the declaration. */
  readonly removals: readonly Fix[]
  /** The text of the moved specifiers, as written between the braces. */
  readonly text: string
}

/** The context the fixes read the source through. */
type Context = RuleContext<ConsistentTypeImportsOptions | undefined, Node>

/** The parents under which a reference re-exports a binding. */
const EXPORT_PARENTS = createSet<string>(['ExportSpecifier', 'ExportDefaultDeclaration', 'TSExportAssignment'])

export default defineRule<ConsistentTypeImportsOptions | undefined, Node>({
  id: 'typescript/consistent-type-imports',
  language: 'code',
  fixable: true,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    const modules = createMap<string, ModuleImports>()
    const annotations =
      context.options?.disallowTypeAnnotations === false
        ? {}
        : {
            TSImportType(node: Node): void {
              context.report({ start: node.start, end: node.end, message: '`import()` type annotations are forbidden.' })
            },
          }
    return {
      ...annotations,
      ImportDeclaration(node) {
        const source = (node.source as Node).value as string
        let entry = modules.get(source)
        if (entry === undefined) {
          entry = { typeOnlyNamedImport: null, reports: [] }
          modules.set(source, entry)
        }
        const specifiers = node.specifiers as readonly Node[]
        if (node.importKind === 'type') {
          if (entry.typeOnlyNamedImport === null && specifiers.every((specifier) => specifier.kind === 'ImportSpecifier'))
            entry.typeOnlyNamedImport = node
          return
        }
        const typeSpecifiers: Node[] = []
        const valueSpecifiers: Node[] = []
        const unusedSpecifiers: Node[] = []
        for (const specifier of specifiers) {
          if (specifier.importKind === 'type') continue
          const variable = analysis.declaredVariables(specifier)[0] as Variable
          if (variable.references.length === 0) unusedSpecifiers.push(specifier)
          else if (variable.references.every(isTypeOnlyUse)) typeSpecifiers.push(specifier)
          else valueSpecifiers.push(specifier)
        }
        if (typeSpecifiers.length > 0) entry.reports.push({ node, typeSpecifiers, valueSpecifiers, unusedSpecifiers })
      },
      'Program:exit'() {
        for (const entry of modules.values()) {
          for (const report of entry.reports) {
            const { node } = report
            if (report.valueSpecifiers.length === 0 && report.unusedSpecifiers.length === 0) {
              // why: an import with attributes, such as `with { type: 'json' }`, cannot become a type import.
              if ((node.attributes as readonly Node[]).length > 0) continue
              context.report({
                start: node.start,
                end: node.end,
                message: 'All imports in the declaration are only used as types. Use `import type`.',
                fix: fixOf(context, report, entry),
              })
            } else {
              const names = report.typeSpecifiers.map((specifier) => `"${(specifier.local as Node).name as string}"`)
              context.report({
                start: node.start,
                end: node.end,
                message: `Imports ${wordList(names)} are only used as type.`,
                fix: fixOf(context, report, entry),
              })
            }
          }
        }
      },
    }
  },
})

/**
 * Whether a reference to a binding of a value import is served by a type-only import: a type
 * position, a `typeof` query, or the computed key of a property signature. A re-export keeps
 * the import's own kind, so it is a value use.
 *
 * @param ref - The reference
 * @returns Whether a type-only import would serve it
 */
function isTypeOnlyUse(ref: Reference): boolean {
  if (EXPORT_PARENTS.has((ref.identifier.parent as Node).kind) && ref.isValueReference) return false
  return ref.isValueReference ? isValueUseInType(ref.identifier) : true
}

/**
 * Whether a value position inside a type needs only the type of its name: the name queried by
 * `typeof`, possibly through a qualified name, or the object of a computed property key.
 *
 * @param node - The identifier, or the qualified name or member expression built on it
 * @returns Whether a type-only import serves the position
 */
function isValueUseInType(node: Node): boolean {
  const parent = node.parent as Node
  switch (parent.kind) {
    case 'TSTypeQuery':
      return true
    case 'TSQualifiedName':
      return isValueUseInType(parent)
    case 'TSPropertySignature':
      return true
    case 'MemberExpression':
      return parent.object === node && isValueUseInType(parent)
    default:
      return false
  }
}

/**
 * Names in a sentence: `"A"`, `"A" and "B"`, `"A", "B" and "C"`.
 *
 * @param names - The quoted names, at least one
 * @returns The list as a phrase
 */
function wordList(names: readonly string[]): string {
  if (names.length === 1) return names[0] as string
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] as string}`
}

/**
 * The specifiers of a declaration by kind.
 *
 * @param node - The import declaration, with at least one specifier
 * @returns Its default, named and namespace specifiers
 */
function classify(node: Node): ClassifiedSpecifiers {
  const specifiers = node.specifiers as readonly Node[]
  const first = specifiers[0] as Node
  return {
    defaultSpecifier: first.kind === 'ImportDefaultSpecifier' ? first : null,
    namedSpecifiers: specifiers.filter((specifier) => specifier.kind === 'ImportSpecifier'),
    namespaceSpecifier: specifiers.find((specifier) => specifier.kind === 'ImportNamespaceSpecifier') ?? null,
  }
}

/**
 * The first token between two offsets whose first character is the one given.
 *
 * @param context - The rule's context
 * @param start - The offset searched from
 * @param end - The offset searched to
 * @param character - The character looked for
 * @returns The token, which the grammar guarantees
 */
function firstTokenBetween(context: Context, start: number, end: number, character: string): SourceToken {
  return tokensBetween(context.tree, start, end).find((token) => context.file.text[token.start] === character) as SourceToken
}

/**
 * The offset where the next token or comment after an offset starts.
 *
 * @param context - The rule's context
 * @param offset - The offset looked from
 * @returns The start of whichever comes first
 */
function nextTokenOrCommentStart(context: Context, offset: number): number {
  const token = tokenAfter(context.tree, offset) as SourceToken
  const comment = context.file.comments.find((candidate) => candidate.start >= offset)
  return comment !== undefined && comment.start < token.start ? comment.start : token.start
}

/**
 * The text of a node.
 *
 * @param context - The rule's context
 * @param node - The node read
 * @returns Its characters
 */
function textOf(context: Context, node: Node): string {
  return context.file.text.slice(node.start, node.end)
}

/**
 * An insertion before a declaration.
 *
 * @param node - The declaration
 * @param text - The text inserted
 * @returns The edit
 */
function insertBefore(node: Node, text: string): Fix {
  return { start: node.start, end: node.start, text }
}

/**
 * The edits that make a declaration a type import: `type` after `import`, and for a default
 * import an empty named list removed.
 *
 * @param context - The rule's context
 * @param node - The declaration
 * @param isDefaultImport - Whether the declaration's one binding is its default import
 * @returns The keyword inserted and, for a default import, its empty braces removed
 */
function typeKeywordEdits(context: Context, node: Node, isDefaultImport: boolean): Fix[] {
  const importToken = tokenAfter(context.tree, node.start) as SourceToken
  const edits: Fix[] = [{ start: importToken.end, end: importToken.end, text: ' type' }]
  if (!isDefaultImport) return edits
  const source = node.source as Node
  const open = tokensBetween(context.tree, importToken.end, source.start).find((token) => context.file.text[token.start] === '{')
  if (open !== undefined) {
    // how: `import A, {} from 'm'` loses its empty braces along with the comma before them.
    const comma = tokenBefore(context.tree, open.start) as SourceToken
    const close = firstTokenBetween(context, open.end, source.start, '}')
    edits.push({ start: comma.start, end: close.end, text: '' })
  }
  return edits
}

/**
 * The edits that take named specifiers out of a declaration, and the text they amount to.
 *
 * @param context - The rule's context
 * @param node - The declaration
 * @param subset - The named specifiers moved out
 * @param all - Every named specifier of the declaration
 * @returns The removals and the moved text
 */
function namedSpecifierEdits(context: Context, node: Node, subset: readonly Node[], all: readonly Node[]): NamedSpecifierEdits {
  const { text } = context.file
  if (all.length === 0) return { removals: [], text: '' }
  if (subset.length === all.length) {
    // how: the whole list goes, with the comma before its brace.
    const open = tokenBefore(context.tree, (subset[0] as Node).start) as SourceToken
    const comma = tokenBefore(context.tree, open.start) as SourceToken
    const close = firstTokenBetween(context, open.end, (node.source as Node).start, '}')
    return { removals: [{ start: comma.start, end: close.end, text: '' }], text: text.slice(open.end, close.start) }
  }
  const groups: Node[][] = []
  let group: Node[] = []
  for (const specifier of all) {
    if (subset.includes(specifier)) group.push(specifier)
    else if (group.length > 0) {
      groups.push(group)
      group = []
    }
  }
  if (group.length > 0) groups.push(group)
  const removals: Fix[] = []
  const texts: string[] = []
  for (const run of groups) {
    const first = run[0] as Node
    const last = run[run.length - 1] as Node
    const before = tokenBefore(context.tree, first.start) as SourceToken
    const after = tokenAfter(context.tree, last.end) as SourceToken
    const isFirst = all[0] === first
    const isLast = all[all.length - 1] === last
    // how: a run keeps one separator: the comma before it goes with it, and a run at either end takes the comma after it.
    const start = text[before.start] === ',' ? before.start : before.end
    const end = (isFirst || isLast) && text[after.start] === ',' ? after.end : last.end
    removals.push({ start, end, text: '' })
    texts.push(text.slice(before.end, after.start))
  }
  return { removals, text: texts.join(',') }
}

/**
 * An insertion of specifiers into the named list of a type import.
 *
 * @param context - The rule's context
 * @param target - The type import receiving them
 * @param text - The specifiers as written, between the braces
 * @returns The edit
 */
function insertIntoNamedList(context: Context, target: Node, text: string): Fix {
  const close = firstTokenBetween(context, target.start, (target.source as Node).start, '}')
  const before = tokenBefore(context.tree, close.start) as SourceToken
  const separator = context.file.text[before.start] === ',' || context.file.text[before.start] === '{' ? '' : ','
  return { start: close.start, end: close.start, text: `${separator}${text}` }
}

/**
 * The fix of a value import with type-only bindings: the keyword when every binding is a type,
 * else the type-only bindings moved to a type import of the module.
 *
 * @param context - The rule's context
 * @param report - The declaration and its bindings by use
 * @param entry - The module's imports
 * @returns The fix, as one replacement
 */
function fixOf(context: Context, report: ValueImportReport, entry: ModuleImports): Fix {
  const { node } = report
  const { text } = context.file
  const { defaultSpecifier, namedSpecifiers, namespaceSpecifier } = classify(node)
  const isType = (specifier: Node): boolean => report.typeSpecifiers.includes(specifier)
  if (namespaceSpecifier !== null && defaultSpecifier === null) return mergeEdits(text, typeKeywordEdits(context, node, false))
  if (defaultSpecifier !== null) {
    if (isType(defaultSpecifier) && namedSpecifiers.length === 0 && namespaceSpecifier === null) {
      return mergeEdits(text, typeKeywordEdits(context, node, true))
    }
  } else if (namedSpecifiers.every(isType)) return mergeEdits(text, typeKeywordEdits(context, node, false))
  const source = textOf(context, node.source as Node)
  const typeNamed = namedSpecifiers.filter(isType)
  const named = namedSpecifierEdits(context, node, typeNamed, namedSpecifiers)
  const edits: Fix[] = []
  const after: Fix[] = []
  if (typeNamed.length > 0) {
    if (entry.typeOnlyNamedImport === null) edits.push(insertBefore(node, `import type {${named.text}} from ${source};\n`))
    else {
      const insertion = insertIntoNamedList(context, entry.typeOnlyNamedImport, named.text)
      // why: an insertion into a later declaration is applied after this declaration's own removals.
      if (entry.typeOnlyNamedImport.end <= node.start) edits.push(insertion)
      else after.push(insertion)
    }
  }
  const namespaceRemovals: Fix[] = []
  if (namespaceSpecifier !== null && isType(namespaceSpecifier)) {
    const comma = tokenBefore(context.tree, namespaceSpecifier.start) as SourceToken
    namespaceRemovals.push({ start: comma.start, end: namespaceSpecifier.end, text: '' })
    edits.push(insertBefore(node, `import type ${textOf(context, namespaceSpecifier)} from ${source};\n`))
  }
  if (defaultSpecifier !== null && isType(defaultSpecifier)) {
    if (report.typeSpecifiers.length === (node.specifiers as readonly Node[]).length) {
      const importToken = tokenAfter(context.tree, node.start) as SourceToken
      edits.push({ start: importToken.end, end: importToken.end, text: ' type' })
    } else {
      const comma = tokenAfter(context.tree, defaultSpecifier.end) as SourceToken
      edits.push(insertBefore(node, `import type ${text.slice(defaultSpecifier.start, comma.start).trim()} from ${source};\n`))
      edits.push({ start: defaultSpecifier.start, end: nextTokenOrCommentStart(context, comma.end), text: '' })
    }
  }
  edits.push(...named.removals, ...namespaceRemovals, ...after)
  return mergeEdits(text, edits)
}
