/**
 * Writes the generated files: every placed declaration with its references renamed, imported or
 * substituted, under a provenance header, and the barrel that re-exports them all.
 *
 * @module types-extract/emit
 */

import type { BoundaryConfig, HeaderConfig } from './config'
import type { Edit } from './edits'
import type { Position } from './references'
import type { Declaration, GraphSymbol, WalkResult } from './walk'
import { posix } from 'node:path'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from './compare'
import { applyEdits, dedent, exportEdits, heritageEdit, indentationBefore } from './edits'
import { repositoryPath } from './sources'

/** One row of the report: a reference or a declaration the extraction wrote differently. */
export interface ReportEntry {
  /** The output the declaration is in. */
  readonly output: string
  /** The declaration, by emitted name. */
  readonly declaration: string
  /** The reference as written upstream, or empty for a note about the declaration itself. */
  readonly reference: string
  /** Where the reference stands. */
  readonly position: Position | ''
  /** Why it was rewritten. */
  readonly reason: string
  /** What was written instead. */
  readonly replacement: string
}

/** What one output holds, for the report. */
export interface OutputSummary {
  /** The output path. */
  readonly output: string
  /** The roots, by emitted name. */
  readonly roots: readonly string[]
  /** The depth followed. */
  readonly depth: number
  /** Every declaration emitted, by name, in file order. */
  readonly declarations: readonly string[]
  /** The upstream files the declarations came from, sorted. */
  readonly sourceFiles: readonly string[]
}

/** Where the declarations came from, for the header. */
export interface Provenance {
  /** The repository, as `owner/name`. */
  readonly repo: string
  /** The ref as configured. */
  readonly ref: string
  /** The commit. */
  readonly sha: string
  /** The copyright line of the upstream license. */
  readonly copyright: string
}

/** What emission is told. */
export interface EmitOptions {
  /** The header's wording. */
  readonly header: HeaderConfig
  /** How references past the boundary are written. */
  readonly boundary: BoundaryConfig
  /** Where the declarations came from. */
  readonly provenance: Provenance
  /** The barrel's path. */
  readonly index: string
  /** The module name the barrel's header carries. */
  readonly indexModule: string
}

/** The generated files and what the report needs. */
export interface Emitted {
  /** The generated texts, by workspace-relative path: every output, then the barrel. */
  readonly files: ReadonlyMap<string, string>
  /** The report's rows. */
  readonly entries: readonly ReportEntry[]
  /** One summary per output, in request order. */
  readonly summaries: readonly OutputSummary[]
}

/** The formatter's line width, past which a re-export is written one name per line. */
const PRINT_WIDTH = 140

/** The names bound in one output file. */
interface Names {
  /** Every name taken. */
  readonly taken: Set<string>
  /** The local name of each imported symbol, by key. */
  readonly imported: Map<string, string>
  /** Imports from sibling outputs: output path to local names by emitted name. */
  readonly siblings: Map<string, Map<string, string>>
  /** Imports from Node built-ins: module to local names by exported name. */
  readonly externals: Map<string, Map<string, string>>
}

/**
 * A name not yet taken: the base, or the base with a numeric suffix.
 *
 * @param taken - The names taken
 * @param base - The preferred name
 * @returns The name, now taken
 */
function claim(taken: Set<string>, base: string): string {
  let name = base
  for (let suffix = 2; taken.has(name); suffix += 1) name = `${base}_${suffix}`
  taken.add(name)
  return name
}

/**
 * The relative specifier from one output to another.
 *
 * @param from - The importing output
 * @param to - The imported output
 * @returns The specifier, extensionless
 */
function specifierBetween(from: string, to: string): string {
  const relative = posix.relative(posix.dirname(from), to).replace(/\.ts$/, '')
  return relative.startsWith('.') ? relative : `./${relative}`
}

/**
 * The node a substitution replaces: the node itself, or the parenthesised, indexed-access, `keyof`,
 * `Pick` or `Omit` type built on it, since `(unknown)[number]`, `keyof unknown` and `Pick<unknown, K>`
 * would not mean anything.
 *
 * @param node - The node substituted
 * @returns The outermost node the substitution must cover
 */
function enclosingOperand(node: ts.Node): ts.Node {
  let current = node
  while (
    ts.isParenthesizedTypeNode(current.parent) ||
    (ts.isIndexedAccessTypeNode(current.parent) && current.parent.objectType === current) ||
    ts.isTypeOperatorNode(current.parent) ||
    isPickedFrom(current)
  ) {
    current = current.parent
  }
  return current
}

/**
 * Whether a node is the type a `Pick` or `Omit` selects keys from: `Pick<unknown, K>` has no keys
 * to select, so the substitution must cover the whole utility type.
 *
 * @param node - The node substituted
 * @returns True when its parent is a `Pick` or `Omit` of it
 */
function isPickedFrom(node: ts.Node): boolean {
  const parent = node.parent
  if (!ts.isTypeReferenceNode(parent) || !ts.isIdentifier(parent.typeName) || parent.typeArguments === undefined) return false
  return (parent.typeName.text === 'Pick' || parent.typeName.text === 'Omit') && parent.typeArguments[0] === node
}

/**
 * The text of a type re-export, on one line when it fits the formatter's width and one name per
 * line otherwise, as the formatter would write it.
 *
 * @param names - The names re-exported, in order
 * @param specifier - The module specifier
 * @returns The statement's text
 */
function exportStatement(names: readonly string[], specifier: string): string {
  const single = `export type { ${names.join(', ')} } from '${specifier}'`
  if (single.length <= PRINT_WIDTH) return single
  return `export type {\n${names.map((name) => `  ${name},`).join('\n')}\n} from '${specifier}'`
}

/**
 * The text of an import of named bindings.
 *
 * @param bindings - Exported names to local names
 * @param module - The module specifier
 * @returns The import statement's text
 */
function importStatement(bindings: ReadonlyMap<string, string>, module: string): string {
  const names = [...bindings.keys()].sort(compareText).map((exported) => {
    const local = bindings.get(exported) as string
    return exported === local ? exported : `${exported} as ${local}`
  })
  return `import type { ${names.join(', ')} } from '${module}'`
}

/**
 * Emits the generated files.
 *
 * @param result - The walk
 * @param options - Header, boundary, provenance and barrel path
 * @returns The files, the report rows and the summaries
 */
export function emit(result: WalkResult, options: EmitOptions): Emitted {
  const emittedName = createMap<string, string>()
  const names = createMap<string, Names>()
  const entries: ReportEntry[] = []
  const note = (output: string, declaration: string, reason: string, replacement: string): void => {
    entries.push({ output, declaration, reference: '', position: '', reason, replacement })
  }
  for (const [output, plan] of result.outputs) {
    const taken = createSet<string>()
    names.set(output, { taken, imported: createMap(), siblings: createMap(), externals: createMap() })
    for (const key of plan.order) {
      const symbol = result.symbols.get(key) as GraphSymbol
      const name = claim(taken, symbol.baseName)
      emittedName.set(key, name)
      if (name !== symbol.name) note(output, name, 'renamed', `${symbol.name} is carried as ${name}`)
      for (const text of symbol.notes) note(output, name, 'rewritten', text)
    }
  }

  const localNameFor = (output: string, key: string): string => {
    const scope = names.get(output) as Names
    const existing = scope.imported.get(key)
    if (existing !== undefined) return existing
    const from = result.placements.get(key) as string
    const exported = emittedName.get(key) as string
    const local = claim(scope.taken, exported)
    scope.imported.set(key, local)
    const bindings = scope.siblings.get(from) ?? createMap<string, string>()
    bindings.set(exported, local)
    scope.siblings.set(from, bindings)
    return local
  }

  const externalNameFor = (output: string, module: string, name: string, written: string): string => {
    const scope = names.get(output) as Names
    const bindings = scope.externals.get(module) ?? createMap<string, string>()
    const existing = bindings.get(name)
    if (existing !== undefined) return existing
    const local = claim(scope.taken, written)
    bindings.set(name, local)
    scope.externals.set(module, bindings)
    return local
  }

  const emitDeclaration = (output: string, symbol: GraphSymbol, declaration: Declaration): string => {
    const { sourceFile, node } = declaration
    const text = sourceFile.text
    const name = emittedName.get(symbol.key) as string
    const edits: Edit[] = [...exportEdits(node, sourceFile)]
    const removed = createMap<ts.HeritageClause, Set<ts.Node>>()
    const report = (reference: string, position: Position, reason: string, replacement: string): void => {
      entries.push({ output, declaration: name, reference, position, reason, replacement })
    }
    const substitute = (substituted: ts.Node, written: string, position: Position, reason: string, text: string): void => {
      const referenceNode = enclosingOperand(substituted)
      // why: an override describes the declaration itself; a member read off it, a key of it or a pick from it is anything at all.
      const replacement = referenceNode === substituted ? text : options.boundary.default
      if (position === 'heritage') {
        const clause = referenceNode.parent as ts.HeritageClause
        const dropped = removed.get(clause) ?? createSet<ts.Node>()
        dropped.add(referenceNode)
        removed.set(clause, dropped)
        report(written, position, reason, 'dropped from the heritage clause')
        return
      }
      edits.push({ start: referenceNode.getStart(sourceFile), end: referenceNode.end, text: replacement })
      report(written, position, reason, replacement)
    }
    const rename = (nameNode: ts.Node, to: string): void => {
      if (nameNode.getText(sourceFile) !== to) edits.push({ start: nameNode.getStart(sourceFile), end: nameNode.end, text: to })
    }
    for (const { reference, target } of declaration.references) {
      const written = reference.nameNode.getText(sourceFile)
      if (target.kind === 'global') continue
      if (target.kind === 'external') {
        rename(
          reference.nameNode,
          externalNameFor(output, target.module, target.name, reference.qualifier === null ? written : target.name)
        )
        continue
      }
      if (target.kind === 'replace') {
        substitute(reference.node, written, reference.position, target.reason, target.text)
        continue
      }
      const placement = result.placements.get(target.key)
      if (placement === undefined) {
        substitute(reference.node, written, reference.position, 'beyond-depth', options.boundary.default)
      } else if (placement === output) {
        rename(reference.nameNode, emittedName.get(target.key) as string)
      } else {
        rename(reference.nameNode, localNameFor(output, target.key))
      }
    }
    for (const oddity of declaration.oddities) {
      if (oddity.kind === 'untyped-parameter' || oddity.kind === 'untyped-member') {
        edits.push({ start: oddity.insertAt as number, end: oddity.insertAt as number, text: oddity.insertText as string })
        report(oddity.node.getText(sourceFile), oddity.position, oddity.kind, `annotated with${(oddity.insertText as string).slice(1)}`)
      } else {
        const replacement = oddity.kind === 'any' ? 'unknown' : options.boundary.default
        substitute(oddity.node, oddity.node.getText(sourceFile), oddity.position, oddity.kind, replacement)
      }
    }
    for (const [clause, dropped] of removed) edits.push(heritageEdit(clause, dropped, edits, sourceFile))
    // note: every emitted statement is an interface or a type alias, which always carries a name.
    rename((node as ts.DeclarationStatement).name as ts.Node, name)
    const start = node.getStart(sourceFile, true)
    const body = applyEdits(
      text.slice(start, node.end),
      edits.map((edit) => ({ start: edit.start - start, end: edit.end - start, text: edit.text }))
    )
    return dedent(body, indentationBefore(sourceFile, start)).replace(/\r\n/g, '\n')
  }

  const files = createMap<string, string>()
  const summaries: OutputSummary[] = []
  const bodies = createMap<string, string[]>()
  for (const [output, plan] of result.outputs) {
    const texts: string[] = []
    for (const key of plan.order) {
      const symbol = result.symbols.get(key) as GraphSymbol
      for (const declaration of symbol.declarations) texts.push(emitDeclaration(output, symbol, declaration))
    }
    bodies.set(output, texts)
  }
  for (const [output, plan] of result.outputs) {
    const scope = names.get(output) as Names
    const sourceFiles = [...createSet(plan.order.map((key) => (result.symbols.get(key) as GraphSymbol).file))].sort()
    const roots = plan.roots.map((key) => emittedName.get(key) as string)
    const header = [
      '/**',
      ` * Generated by ${options.header.tool} from ${options.provenance.repo} at ${options.provenance.sha} (${options.provenance.ref}). DO NOT EDIT.`,
      ' *',
      ' * Declarations copied from:',
      ...sourceFiles.map((file) => ` *   ${repositoryPath(file)}`),
      ` * Roots: ${roots.join(', ')}`,
      ` * Depth: ${plan.request.depth}; a reference past it, or outside the followed sources, is written as \`${options.boundary.default}\` and listed in REPORT.md.`,
      ` * Regenerate with \`${options.header.regenerate}\`; verify with \`${options.header.check}\`.`,
      ' *',
      ` * ${options.provenance.copyright.replace(/\.$/, '')}. Licensed under the terms reproduced in NOTICE.md.`,
      ' */',
    ]
    const imports = [
      ...[...scope.externals.keys()]
        .sort(compareText)
        .map((module) => importStatement(scope.externals.get(module) as Map<string, string>, module)),
      ...[...scope.siblings.keys()]
        .sort(compareText)
        .map((from) => importStatement(scope.siblings.get(from) as Map<string, string>, specifierBetween(output, from))),
    ]
    const sections = [header.join('\n'), ...(imports.length === 0 ? [] : [imports.join('\n')]), ...(bodies.get(output) as string[])]
    files.set(output, `${sections.join('\n\n')}\n`)
    summaries.push({
      output,
      roots,
      depth: plan.request.depth,
      declarations: plan.order.map((key) => emittedName.get(key) as string),
      sourceFiles,
    })
  }
  // why: the barrel is linted, and the import-order rule wants its statements sorted by specifier.
  const specifiers = createMap<string, string>()
  for (const [output, plan] of result.outputs) {
    const names = plan.order.map((key) => emittedName.get(key) as string).sort(compareText)
    const specifier = specifierBetween(options.index, output)
    specifiers.set(specifier, exportStatement(names, specifier))
  }
  const exportLines = [...specifiers.keys()].sort(compareText).map((specifier) => specifiers.get(specifier) as string)
  const indexHeader = [
    '/**',
    ` * Upstream-compatible declarations of ${options.provenance.repo} at ${options.provenance.sha} (${options.provenance.ref}), generated by`,
    ` * ${options.header.tool}; every name is re-exported here. DO NOT EDIT.`,
    ` * Regenerate with \`${options.header.regenerate}\`; verify with \`${options.header.check}\`.`,
    ' *',
    ` * @module ${options.indexModule}`,
    ' */',
  ]
  files.set(options.index, `${indexHeader.join('\n')}\n${exportLines.join('\n')}\n`)
  return { files, entries, summaries }
}
