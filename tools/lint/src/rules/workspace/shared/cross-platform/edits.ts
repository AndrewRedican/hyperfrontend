/**
 * How a fix names a Node export: through the file's own import of it, aliases included, through
 * a default or namespace import of its module, or by adding the name to an import, or adding an
 * import where the import order expects it. A name something else holds at the fix makes the
 * fix impossible. Also the quoting a fix writes text with.
 *
 * @module rules/workspace/shared/cross-platform/edits
 */

import type { Node } from '../../../../code/model.ts'
import type { Fix, Suggestion } from '../../../../engine/report.ts'
import type { ScopeAnalysis } from '../../../../scope/analysis.ts'
import type { Variable } from '../../../../scope/model.ts'
import type { Origin, Tracer } from './origin.ts'
import { findVariable, scopeOf } from '../../../../scope/analysis.ts'
import { mergeEdits } from '../../../typescript/shared/edits.ts'
import { compareModuleStatements, isTypeOnly } from '../sources.ts'

/** The Node modules a fix imports from. */
export type NodeModule = 'path' | 'url' | 'os'

/** How a fix names exports. */
export interface Naming {
  /** The expression naming each export, in order. */
  readonly texts: readonly string[]
  /** The edits adding imports. */
  readonly edits: readonly Fix[]
}

/** Names Node exports at a location, or answers null when a name is taken. */
export type Namer = (module: NodeModule, names: readonly string[], at: Node, accept?: (variable: Variable) => boolean) => Naming | null

/**
 * Text as a single-quoted string literal.
 *
 * @param text - The string's value
 * @returns The literal
 */
export function quote(text: string): string {
  return `'${text.replace(/[\\']/g, (character) => `\\${character}`)}'`
}

/**
 * Text escaped for the inside of a template literal.
 *
 * @param text - The text's value
 * @returns The text as a template writes it
 */
export function templateText(text: string): string {
  return text.replace(/\\|`|\$\{/g, (escaped) => `\\${escaped}`)
}

/**
 * An expression's text as a call argument: a sequence gets its parentheses back.
 *
 * @param text - The file's text
 * @param node - The expression
 * @returns Its source, parenthesised when it is a sequence
 */
export function argumentText(text: string, node: Node): string {
  const source = text.slice(node.start, node.end)
  return node.kind === 'SequenceExpression' ? `(${source})` : source
}

/**
 * Builds the namer of a file.
 *
 * @param program - The file's tree, whose imports are reused or extended
 * @param analysis - Its scope analysis, which tells a taken name
 * @returns How the file's fixes name Node exports
 */
export function createNamer(program: Node, analysis: ScopeAnalysis): Namer {
  const statements = program.body as readonly Node[]
  const modules = statements.filter((statement) => statement.kind === 'ImportDeclaration')
  return (module, names, at, accept) => {
    const sources = [`node:${module}`, module]
    const imports = modules.filter((statement) => !isTypeOnly(statement) && sources.includes((statement.source as Node).value as string))
    const scope = scopeOf(analysis, at)
    const holds = (specifier: Node): boolean => findVariable(scope, (specifier.local as Node).name as string)?.defs[0]?.node === specifier
    const texts: string[] = []
    const added: string[] = []
    for (const name of names) {
      const specifiers = imports.flatMap((statement) => statement.specifiers as readonly Node[])
      const named = specifiers.find(
        (specifier) =>
          specifier.kind === 'ImportSpecifier' &&
          ((specifier.imported as Node).name ?? (specifier.imported as Node).value) === name &&
          holds(specifier)
      )
      const whole = specifiers.find((specifier) => specifier.kind !== 'ImportSpecifier' && holds(specifier))
      const taken = findVariable(scope, name)
      if (named !== undefined) texts.push((named.local as Node).name as string)
      else if (whole !== undefined) texts.push(`${(whole.local as Node).name as string}.${name}`)
      else if (taken === null || accept?.(taken) === true) {
        texts.push(name)
        if (taken === null) added.push(name)
      } else return null
    }
    if (added.length === 0) return { texts, edits: [] }
    const target = imports.find((statement) =>
      (statement.specifiers as readonly Node[]).some((specifier) => specifier.kind === 'ImportSpecifier')
    )
    if (target !== undefined) {
      const last = (target.specifiers as readonly Node[])[(target.specifiers as readonly Node[]).length - 1] as Node
      return { texts, edits: [{ start: last.end, end: last.end, text: `, ${added.join(', ')}` }] }
    }
    const statement = `import { ${added.join(', ')} } from 'node:${module}'`
    const probe = { kind: 'ImportDeclaration', importKind: 'value', source: { value: `node:${module}` } } as unknown as Node
    const later = modules.find((existing) => compareModuleStatements(probe, existing) < 0)
    if (later !== undefined) return { texts, edits: [{ start: later.start, end: later.start, text: `${statement}\n` }] }
    const last = modules[modules.length - 1]
    if (last !== undefined) return { texts, edits: [{ start: last.end, end: last.end, text: `\n${statement}` }] }
    const first = statements[0] as Node
    return { texts, edits: [{ start: first.start, end: first.start, text: `${statement}\n` }] }
  }
}

/** The edits of a fix and the replacement a suggestion names. */
export interface Rewrite {
  /** The replacement as the suggestion names it. */
  readonly replacement: string
  /** The edits, imports included. */
  readonly edits: readonly Fix[]
}

/** Builds a rewrite in the native or the portable flavour, or answers null when it cannot. */
export type Build = (portable: boolean) => Rewrite | null

/** What the checks of one file share. */
export interface Scan {
  /** The file's text. */
  readonly text: string
  /** Where values come from. */
  readonly tracer: Tracer
  /** How fixes name Node exports. */
  readonly namer: Namer
  /** Whether the project runs on Node, which turns on the second tier and the Node-only checks. */
  readonly node: boolean
  /** Whether the file imports a `node:` module. */
  readonly nodeImports: boolean
  /** The commands that are `.cmd` shims on Windows. */
  readonly shims: ReadonlySet<string>
  /** Reports a problem at a node. */
  readonly report: (node: Node, message: string, fix?: Fix | null, suggestions?: readonly Suggestion[]) => void
}

/** The suggestion texts. */
const SUGGESTIONS = {
  native: 'Treat it as a native OS path: `{{ replacement }}`',
  portable: 'Treat it as a portable POSIX path: `{{ replacement }}`',
} as const

/**
 * Reports a value by its tier: a proven native value with the native fix, a path-like name in a
 * Node project with the native and, when allowed, the portable suggestion.
 *
 * @param scan - The file's checks
 * @param node - The node reported
 * @param message - What the report says
 * @param origin - What is known of the value
 * @param build - Builds the rewrite in a flavour
 * @param portable - Whether the portable suggestion applies
 */
export function reportTiered(scan: Scan, node: Node, message: string, origin: Origin, build: Build, portable = true): void {
  if (origin.domain === 'native' || origin.domain === 'relative') {
    const rewrite = build(false)
    scan.report(node, message, rewrite === null ? null : mergeEdits(scan.text, rewrite.edits))
  } else if (origin.named && scan.node) {
    const flavours = portable ? ([false, true] as const) : ([false] as const)
    const suggestions = flavours.flatMap((flavour) => {
      const rewrite = build(flavour)
      if (rewrite === null) return []
      const message = SUGGESTIONS[flavour ? 'portable' : 'native'].replace('{{ replacement }}', rewrite.replacement)
      return [{ message, fix: mergeEdits(scan.text, rewrite.edits) }]
    })
    scan.report(node, message, null, suggestions)
  }
}
