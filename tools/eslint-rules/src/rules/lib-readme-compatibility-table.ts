import type { Rule } from 'eslint'
import { basename, dirname } from 'node:path'
import { isPublishableLibrary, readPackageJson, readProjectJson } from '../utils/nx-project'

/**
 * Rule identifier for the lib-readme-compatibility-table rule.
 */
export const RULE_NAME = 'lib-readme-compatibility-table'

/** The heading of the section the table sits in. */
const COMPATIBILITY_HEADING = '## Compatibility'

/** The first column's header. */
const ENVIRONMENT_HEADER = 'Environment'

/**
 * The runtimes the table lists, in the order the documentation site draws
 * them, each with the label its row carries.
 */
export const ENVIRONMENT_ROWS: ReadonlyArray<readonly [key: string, label: string]> = [
  ['node', 'Node.js'],
  ['browser', 'Modern Browsers'],
  ['webWorker', 'Web Workers'],
]

/** The glyph each declared support level renders as; an undeclared level renders as unsupported. */
const GLYPHS: Readonly<Record<string, string>> = { full: '✅', partial: '⚠️', none: '❌' }

/** The compatibility a project declares, as far as this rule reads it. */
interface CompatibilityDeclaration {
  /** Support level by runtime. */
  environments?: Record<string, unknown>
}

/** The `metadata` block of a project configuration, as far as this rule reads it. */
interface ProjectMetadata {
  /** Where the package runs. */
  compatibility?: CompatibilityDeclaration
}

/**
 * The table a package's declaration renders as.
 *
 * One row per runtime, with the Node.js row carrying the floor the manifest
 * declares. Written in the shape the formatter leaves it in, so the fix the
 * rule offers is stable across a format pass.
 *
 * @param environments - Support level by runtime, from `metadata.compatibility.environments`.
 * @param nodeRange - The `engines.node` range from the manifest, or undefined for none.
 * @returns The table's lines.
 */
export function expectedTable(environments: Readonly<Record<string, unknown>>, nodeRange: string | undefined): string[] {
  const floor = /^>=\s*(\d+)/.exec(nodeRange ?? '')
  const rows = ENVIRONMENT_ROWS.map(([key, label]): [string, string] => {
    const level = environments[key]
    const glyph = typeof level === 'string' ? (GLYPHS[level] ?? GLYPHS['none']) : GLYPHS['none']
    return [key === 'node' && floor !== null ? `${label} >= ${floor[1]}` : label, glyph ?? '']
  })
  const width = rows.reduce((widest, [label]) => (label.length > widest ? label.length : widest), ENVIRONMENT_HEADER.length)
  return [
    `| ${ENVIRONMENT_HEADER.padEnd(width)} | Supported |`,
    `| ${'-'.repeat(width)} | :-------: |`,
    ...rows.map(([label, glyph]) => `| ${label.padEnd(width)} |    ${glyph}     |`),
  ]
}

/**
 * A table row reduced to what it says: its cells, trimmed and joined.
 *
 * @param line - One row of a markdown table.
 * @returns The cells, so two rows that differ only in padding compare equal.
 */
export function cellsOf(line: string): string {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
    .join(' | ')
}

/**
 * Whether a table says what the expected one says, padding aside.
 *
 * @param actual - The table as written.
 * @param expected - The table the declaration renders as.
 * @returns True when every row but the delimiter row carries the same cells.
 */
export function sameTable(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((line, index) => index === 1 || cellsOf(line) === cellsOf(expected[index] ?? ''))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: "Keep a publishable library README's compatibility table equal to what its project.json declares",
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [],
    messages: {
      missingTable:
        'The Compatibility section carries no table. Add the runtime table, which is checked against metadata.compatibility in project.json.',
      tableDrift:
        'The compatibility table does not match metadata.compatibility in project.json and engines.node in package.json. Run lint with --fix to regenerate it.',
    },
  },

  create(context) {
    const filename = context.filename
    if (basename(filename) !== 'README.md') {
      return {}
    }
    const projectRoot = dirname(filename)
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }
    const metadata = (readProjectJson(projectRoot)?.['metadata'] ?? {}) as ProjectMetadata
    const engines = (readPackageJson(projectRoot)?.['engines'] ?? {}) as Record<string, unknown>
    const nodeRange = engines['node']
    const expected = expectedTable(metadata.compatibility?.environments ?? {}, typeof nodeRange === 'string' ? nodeRange : undefined)

    return {
      root(node: Rule.Node) {
        const lines = context.sourceCode.getText().split('\n')
        const heading = lines.findIndex((line) => line.startsWith(COMPATIBILITY_HEADING))
        if (heading === -1) {
          return
        }
        const sectionEnd = lines.findIndex((line, index) => index > heading && (line.startsWith('## ') || line.startsWith('### ')))
        const end = sectionEnd === -1 ? lines.length : sectionEnd
        const start = lines.findIndex((line, index) => index > heading && index < end && line.startsWith('|'))
        if (start === -1) {
          context.report({
            node,
            loc: { start: { line: heading + 1, column: 0 }, end: { line: heading + 1, column: COMPATIBILITY_HEADING.length } },
            messageId: 'missingTable',
          })
          return
        }
        let stop = start
        while (stop < end && (lines[stop] ?? '').startsWith('|')) {
          stop += 1
        }
        if (sameTable(lines.slice(start, stop), expected)) {
          return
        }
        // why: a fix replaces a character range, so each line's offset is the length of everything before it plus one newline per line
        const offsets = lines.reduce<number[]>((acc, line) => [...acc, (acc.at(-1) ?? 0) + line.length + 1], [0])
        context.report({
          node,
          loc: { start: { line: start + 1, column: 0 }, end: { line: stop, column: (lines[stop - 1] ?? '').length } },
          messageId: 'tableDrift',
          fix: (fixer) => fixer.replaceTextRange([offsets[start] ?? 0, (offsets[stop] ?? 0) - 1], expected.join('\n')),
        })
      },
    }
  },
}

export default rule
