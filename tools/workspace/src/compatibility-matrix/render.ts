import type { MatrixLibrary, SupportLevel } from './models'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { shortNameOf } from './collect'

/**
 * Glyphs the tables use: one per declared support level, plus the marker for an
 * environment a package declares nothing about. A shipped output format reuses
 * the `full` glyph and a missing one reuses `none`.
 */
const GLYPH = {
  full: '✅',
  partial: '⚠️',
  none: '❌',
  unknown: '❓',
}

/**
 * Placeholder for a table cell with no value to show.
 */
const EMPTY_CELL = '-'

/**
 * Escapes the characters that would break a markdown table cell: the pipe that
 * splits a cell in two, and the backslash that would otherwise swallow the
 * escape placed before that pipe.
 *
 * @param value - The cell text.
 * @returns The cell text, safe to place between pipes.
 */
function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

/**
 * Wraps a value in backticks so markdown renders it as code.
 *
 * @param value - The value to wrap.
 * @returns The value between backticks.
 */
function code(value: string): string {
  return `\`${value}\``
}

/**
 * Renders a GitHub-flavoured markdown table with unpadded cells.
 *
 * @param headers - Column headings.
 * @param rows - Cell values, one array per row.
 * @returns The table as markdown.
 */
function renderTable(headers: string[], rows: string[][]): string {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`]

  for (const row of rows) {
    lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
  }

  return lines.join('\n')
}

/**
 * Renders the glyph for a declared support level.
 *
 * @param level - The declared level, or null when nothing is declared.
 * @returns The glyph for the platform table.
 */
function supportGlyph(level: SupportLevel | null): string {
  return level === null ? GLYPH.unknown : GLYPH[level]
}

/**
 * Renders the glyph for a format the package either ships or does not.
 *
 * @param present - Whether the format is configured.
 * @returns The glyph for the output format table.
 */
function presenceGlyph(present: boolean): string {
  return present ? GLYPH.full : GLYPH.none
}

/**
 * Renders the platform support section: the environment table, the glyph
 * legend, and the per-package caveats.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderPlatformSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    supportGlyph(library.environments.node),
    supportGlyph(library.environments.browser),
    supportGlyph(library.environments.webWorker),
    presenceGlyph(library.formats.iife || library.formats.umd),
  ])

  const legend = [
    `Legend: ${GLYPH.full} full support, ${GLYPH.partial} partial support, ${GLYPH.none} no support,`,
    `${GLYPH.unknown} nothing declared. CDN Bundle marks the packages whose build produces an IIFE or UMD bundle.`,
  ].join(' ')

  const parts = ['## Platform Support', renderTable(['Library', 'Node.js', 'Browser', 'Web Worker', 'CDN Bundle'], rows), legend]
  const notes: string[] = []

  for (const library of libraries) {
    if (library.note !== null) {
      notes.push(`- ${code(library.packageName)}: ${library.note}`)
    }
  }

  if (notes.length > 0) {
    parts.push('**Notes**')
    parts.push(notes.join('\n'))
  }

  return parts.join('\n\n')
}

/**
 * Renders the output format section: which builds each package ships and the
 * global names its browser bundles claim.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderOutputFormatsSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    presenceGlyph(library.formats.esm),
    presenceGlyph(library.formats.cjs),
    presenceGlyph(library.formats.iife),
    presenceGlyph(library.formats.umd),
    library.globalNames.length > 0 ? library.globalNames.map(code).join(', ') : EMPTY_CELL,
  ])

  return ['## Output Formats', renderTable(['Library', 'ESM', 'CJS', 'IIFE', 'UMD', 'Global name'], rows)].join('\n\n')
}

/**
 * Renders the engine requirement section from each package's `engines` block.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderEngineSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    library.nodeEngine === null ? EMPTY_CELL : code(library.nodeEngine),
    library.npmEngine === null ? EMPTY_CELL : code(library.npmEngine),
  ])

  return ['## Engine Requirements', renderTable(['Library', 'Node.js', 'npm'], rows)].join('\n\n')
}

/**
 * Turns a package's short name into an identifier Mermaid parses unambiguously.
 *
 * @param shortName - Package name without its scope.
 * @returns The node identifier.
 */
function mermaidId(shortName: string): string {
  return shortName.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Renders the Mermaid flowchart of first-party dependency edges.
 *
 * @param libraries - The rows to draw.
 * @returns The fenced Mermaid block.
 */
function renderDependencyDiagram(libraries: MatrixLibrary[]): string {
  const documented = createSet(libraries.map((library) => library.packageName))
  const lines = ['flowchart TB']

  for (const library of libraries) {
    lines.push(`    ${mermaidId(library.shortName)}["${library.shortName}"]`)
  }

  for (const library of libraries) {
    for (const dependency of library.dependencies) {
      if (!documented.has(dependency.packageName)) {
        continue
      }

      const arrow = dependency.peer ? '-.->' : '-->'
      lines.push(`    ${mermaidId(library.shortName)} ${arrow} ${mermaidId(shortNameOf(dependency.packageName))}`)
    }
  }

  return ['```mermaid', '---', 'config:', '  theme: base', '  themeVariables:', '    fontSize: 12px', '---', ...lines, '```'].join('\n')
}

/**
 * Renders the dependency section: the table of first-party edges and the
 * diagram drawing the same edges.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderDependencySection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    library.dependencies.length > 0
      ? library.dependencies.map((dependency) => `${code(dependency.packageName)}${dependency.peer ? ' (peer)' : ''}`).join(', ')
      : EMPTY_CELL,
  ])

  return [
    '## Dependency Graph',
    renderTable(['Library', 'Depends on'], rows),
    'Solid edges are runtime dependencies; dotted edges are peer dependencies.',
    renderDependencyDiagram(libraries),
  ].join('\n\n')
}

/**
 * Renders the published version section from each package's `version` field.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderVersionSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [code(library.packageName), library.version === null ? EMPTY_CELL : code(library.version)])

  return ['## Published Versions', renderTable(['Library', 'Version'], rows)].join('\n\n')
}

/**
 * Renders the whole document from already collected rows.
 *
 * @param libraries - The rows to render, sorted by package name.
 * @returns The document text, ending in exactly one newline.
 */
export function renderCompatibilityDocument(libraries: MatrixLibrary[]): string {
  const sections = [
    '# Library Compatibility Matrix',
    `> Generated from each package's ${code('project.json')} and ${code('package.json')}. Regenerate it with ${code('npx nx lint:all')} rather than editing it by hand.`,
    renderPlatformSection(libraries),
    renderOutputFormatsSection(libraries),
    renderEngineSection(libraries),
    renderDependencySection(libraries),
    renderVersionSection(libraries),
  ]

  return `${sections.join('\n\n')}\n`
}
