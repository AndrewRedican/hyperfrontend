import type { TempWorkspace } from '../testing'
import { readFileSync } from 'node:fs'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, { cellsOf, ENVIRONMENT_ROWS, expectedTable, RULE_NAME, sameTable } from './lib-readme-compatibility-table'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const PUBLISHABLE = {
  projectType: 'library',
  targets: { build: {}, publish: {} },
  metadata: { compatibility: { environments: { node: 'full', browser: 'full', webWorker: 'partial' } } },
}

const EXPECTED = [
  '| Environment     | Supported |',
  '| --------------- | :-------: |',
  '| Node.js >= 18   |    ✅     |',
  '| Modern Browsers |    ✅     |',
  '| Web Workers     |    ⚠️     |',
]

/**
 * A package readme whose Compatibility section holds the given lines.
 *
 * @param section - Lines inside the Compatibility section.
 * @param trailing - Whether a section follows, or the table runs to the end of the file.
 * @returns Markdown.
 */
function readme(section: readonly string[], trailing = true): string {
  const tail = trailing ? ['', '### Output Formats', '', 'Formats.', ''] : []
  return ['# @hyperfrontend/alpha', '', '## Compatibility', '', ...section, ...tail].join('\n')
}

/**
 * Lays out a workspace with one publishable package.
 *
 * @param content - The package readme.
 * @param overrides - Files that replace the defaults, by path.
 * @returns The temporary workspace.
 */
function createWorkspace(content: string, overrides: Record<string, string> = {}): TempWorkspace {
  return manager.create({
    files: {
      'nx.json': '{}',
      'libs/alpha/project.json': stringify(PUBLISHABLE),
      'libs/alpha/package.json': stringify({ name: '@hyperfrontend/alpha', engines: { node: '>=18.0.0' } }),
      'libs/alpha/README.md': content,
      ...overrides,
    },
  })
}

/** One report, with the text a fix would leave behind. */
interface Outcome {
  /** The message reported. */
  messageId: string
  /** The readme after the fix, or undefined when no fix was offered. */
  fixed: string | undefined
}

/**
 * Runs the rule over the package readme of a workspace.
 *
 * @param workspace - Where the package and its readme were laid out.
 * @param file - The readme's path within it.
 * @returns Every report, with its fix applied to the source.
 */
function lint(workspace: TempWorkspace, file = 'libs/alpha/README.md'): Outcome[] {
  const text = readFileSync(workspace.getPath(file), 'utf8')
  const report = jest.fn()
  const context = { filename: workspace.getPath(file), options: [], sourceCode: { getText: () => text }, report }
  // @ts-expect-error - partial mock
  rule.create(context).root?.({ type: 'root' })
  return report.mock.calls.map(([call]) => {
    const fix = call.fix?.({ replaceTextRange: (range: [number, number], replacement: string) => ({ range, text: replacement }) })
    return {
      messageId: call.messageId,
      fixed: fix === undefined ? undefined : `${text.slice(0, fix.range[0])}${fix.text}${text.slice(fix.range[1])}`,
    }
  })
}

describe('lib-readme-compatibility-table', () => {
  describe('rule metadata', () => {
    it('exports the rule name and offers fixes', () => {
      expect({ name: RULE_NAME, type: rule.meta?.type, fixable: rule.meta?.fixable }).toEqual({
        name: 'lib-readme-compatibility-table',
        type: 'problem',
        fixable: 'code',
      })
    })

    it('lists the three runtimes the site draws', () => {
      expect(ENVIRONMENT_ROWS.map(([key]) => key)).toEqual(['node', 'browser', 'webWorker'])
    })
  })

  describe('expectedTable', () => {
    it('renders each declared level as its glyph, with the Node.js floor from the manifest', () => {
      expect(expectedTable({ node: 'full', browser: 'full', webWorker: 'partial' }, '>=18.0.0')).toEqual(EXPECTED)
    })

    it('renders an undeclared, unknown or none level as unsupported, and no floor without a manifest range', () => {
      expect(expectedTable({ node: 'none', browser: 'sometimes', webWorker: 3 }, undefined)).toEqual([
        '| Environment     | Supported |',
        '| --------------- | :-------: |',
        '| Node.js         |    ❌     |',
        '| Modern Browsers |    ❌     |',
        '| Web Workers     |    ❌     |',
      ])
    })
  })

  describe('cellsOf and sameTable', () => {
    it('compares rows by their trimmed cells and ignores the delimiter row', () => {
      const padded = [
        '|Environment|Supported|',
        '|---|---|',
        '|  Node.js >= 18  |✅|',
        '| Modern Browsers |    ✅     |',
        '| Web Workers |  ⚠️  |',
      ]
      expect({ cells: cellsOf('|  a  | b |'), same: sameTable(padded, EXPECTED) }).toEqual({ cells: 'a | b', same: true })
    })

    it('tells a table with a different row count or a different cell apart', () => {
      expect([sameTable(EXPECTED.slice(0, 4), EXPECTED), sameTable([...EXPECTED.slice(0, 4), '| Web Workers |  ✅  |'], EXPECTED)]).toEqual(
        [false, false]
      )
    })
  })

  describe('scope', () => {
    it('skips a markdown file that is not a readme', () => {
      const workspace = createWorkspace(readme(['| x |']), { 'libs/alpha/GUIDE.md': readme(['| x |']) })
      expect(lint(workspace, 'libs/alpha/GUIDE.md')).toEqual([])
    })

    it('skips a readme outside a publishable library', () => {
      const workspace = createWorkspace(readme(['| x |']), { 'libs/alpha/project.json': stringify({ projectType: 'library' }) })
      expect(lint(workspace)).toEqual([])
    })

    it('leaves a readme with no Compatibility section to the structure rule', () => {
      expect(lint(createWorkspace('# @hyperfrontend/alpha\n\n## Quick Start\n\n| x |\n'))).toEqual([])
    })
  })

  describe('reports', () => {
    it('accepts a table that says what the declaration says, however it is padded', () => {
      const padded = ['|Environment|Supported|', '|---|---|', '|Node.js >= 18|✅|', '|Modern Browsers|✅|', '|Web Workers|⚠️|']
      expect(lint(createWorkspace(readme(padded)))).toEqual([])
    })

    it('reports a section with no table', () => {
      expect(lint(createWorkspace(readme(['Prose only.'])))).toEqual([{ messageId: 'missingTable', fixed: undefined }])
    })

    it('replaces a drifted table with the declared one', () => {
      const drifted = ['| Platform | Support |', '| --- | :-: |', '| Browser | ✅ |', '| Deno | ✅ |']
      expect(lint(createWorkspace(readme(drifted)))).toEqual([{ messageId: 'tableDrift', fixed: readme(EXPECTED) }])
    })

    it('replaces a table that runs to the end of the file, and reads no floor from a manifest without engines', () => {
      const workspace = createWorkspace(readme(['| x |'], false), {
        'libs/alpha/package.json': stringify({ name: '@hyperfrontend/alpha' }),
      })
      expect(lint(workspace)).toEqual([
        {
          messageId: 'tableDrift',
          fixed: readme(
            EXPECTED.map((line) => line.replace('Node.js >= 18  ', 'Node.js        ')),
            false
          ),
        },
      ])
    })

    it('treats a project with no compatibility metadata as running nowhere', () => {
      const workspace = createWorkspace(readme(EXPECTED), {
        'libs/alpha/project.json': stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
      })
      expect(lint(workspace).map((outcome) => outcome.messageId)).toEqual(['tableDrift'])
    })
  })
})
