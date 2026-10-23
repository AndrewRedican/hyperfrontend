import type { RuleModule } from '../engine/rule'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { ruleIndex, RULE_INDEX } from '../../scripts/rule-index'
import { effectiveConfig, projectConfig } from '../config/resolve'
import { lintFile } from '../engine/lint-file'
import { PACKAGED_RULES } from './catalogue'
import { RULE_IDS } from './ids'

/** Where every packaged rule is documented, one file per rule, the id's slash a directory. */
const DOCS = join(import.meta.dirname, '..', '..', 'docs', 'rules')

/**
 * Rules whose documents show accepted code only: two report nothing by design, marking variables
 * as used for `typescript/no-unused-vars`, and the parser rejects every octal literal before
 * `no-octal` could see one.
 */
const ACCEPTS_ONLY = createSet(['react/jsx-uses-react', 'react/jsx-uses-vars', 'no-octal'])

/** One code block of a document's examples. */
interface Example {
  /** Whether the block must report (❌) or must not (✅). */
  readonly reports: boolean
  /** The heading the block sits under. */
  readonly heading: string
  /** The code. */
  readonly code: string
  /** The options the block is linted with, from an `<!-- options: … -->` line before it. */
  readonly options: unknown
  /** The fence's language, which picks the kind of file the block is linted as. */
  readonly fence: string
}

/**
 * The example blocks of a rule document: every fenced block under a `### ❌` or `### ✅` heading
 * of its `## Examples` section.
 *
 * @param text - The document
 * @returns The blocks in order
 */
function examplesOf(text: string): Example[] {
  const lines = text.split(/\r?\n/)
  const examples: Example[] = []
  let heading = ''
  let options: unknown
  let inside = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string
    if (line.startsWith('## ')) {
      inside = line === '## Examples'
      continue
    }
    if (!inside) {
      if (line.startsWith('```')) index = closingFence(lines, index)
      continue
    }
    if (line.startsWith('### ')) {
      heading = line.slice(4)
      options = undefined
    } else if (line.startsWith('<!-- options: ')) {
      options = parse(line.slice('<!-- options: '.length, line.lastIndexOf(' -->')))
    } else if (line.startsWith('```') && (heading.startsWith('❌') || heading.startsWith('✅'))) {
      const end = closingFence(lines, index)
      const fence = line.replace(/^`+/, '').trim()
      examples.push({ reports: heading.startsWith('❌'), heading, code: `${lines.slice(index + 1, end).join('\n')}\n`, options, fence })
      index = end
    } else if (line.startsWith('```')) {
      index = closingFence(lines, index)
    }
  }
  return examples
}

/**
 * The line that closes a fenced block.
 *
 * @param lines - The document's lines
 * @param open - The index of the opening fence
 * @returns The index of the closing fence, or the line count when the block is never closed
 */
function closingFence(lines: readonly string[], open: number): number {
  const fence = /^`+/.exec(lines[open] as string)?.[0] as string
  let end = open + 1
  while (end < lines.length && (lines[end] as string).trimEnd() !== fence) end += 1
  return end
}

/** The file a fence language is linted as. */
const FENCE_FILES: Readonly<Record<string, string>> = {
  tsx: '/project/src/example.tsx',
  jsx: '/project/src/example.jsx',
  js: '/project/src/example.js',
  javascript: '/project/src/example.js',
  json: '/project/package.json',
  markdown: '/project/README.md',
  md: '/project/README.md',
}

/**
 * The file an example is linted as: by its fence language when that names a kind of file, by the
 * language the rule reads otherwise.
 *
 * @param rule - The rule the example belongs to, whose language is the fallback
 * @param fence - The example's fence language
 * @returns A path the engine reads in that language
 */
function examplePath(rule: RuleModule, fence: string): string {
  const byFence = FENCE_FILES[fence]
  if (byFence !== undefined) return byFence
  if (rule.language === 'json') return '/project/package.json'
  if (rule.language === 'markdown') return '/project/README.md'
  if (rule.language === 'text') return '/project/workflow.yml'
  return rule.id.startsWith('react') ? '/project/src/example.tsx' : '/project/src/example.ts'
}

/**
 * What linting an example with its rule alone reported.
 *
 * @param rule - The rule the example documents, linted alone
 * @param example - The code block and the options it is linted with
 * @returns The rule's messages and any parse failure
 */
function lintExample(rule: RuleModule, example: Example): string[] {
  const setting = example.options === undefined ? 'error' : (['error', example.options] as const)
  const config = effectiveConfig(projectConfig([{ rules: { [rule.id]: setting } }]), 'example')
  const path = examplePath(rule, example.fence)
  const outcome = lintFile(
    { path, root: '/project', relativePath: path.slice('/project/'.length), text: example.code },
    { config, rules: new Map([[rule.id, rule]]), fix: false }
  )
  return outcome.messages.map((message) => (message.fatal ? `fatal: ${message.message}` : `${message.ruleId}: ${message.message}`))
}

describe('the rule documentation', () => {
  it('has a current index, which `scripts/rule-index.ts` rewrites', async () => {
    expect(parse(readFileSync(RULE_INDEX, 'utf8'))).toEqual(await ruleIndex())
  })

  it('has a document for every packaged rule', () => {
    expect(RULE_IDS.filter((id) => !existsSync(join(DOCS, `${id}.md`)))).toEqual([])
  })

  for (const id of RULE_IDS) {
    const file = join(DOCS, `${id}.md`)
    if (!existsSync(file)) continue
    describe(id, () => {
      const text = readFileSync(file, 'utf8')

      it('opens with the id, a purpose and the sections the catalogue renders', () => {
        const [title, , purpose] = text.split(/\r?\n/)
        expect({
          title,
          purpose: purpose !== undefined && purpose.trim() !== '' && !purpose.startsWith('#'),
          options: /^## Options$/m.test(text),
          examples: /^## Examples$/m.test(text),
        }).toEqual({ title: `# ${id}`, purpose: true, options: true, examples: true })
      })

      it('shows code the rule reports and code it accepts', () => {
        const examples = examplesOf(text)
        expect({ reports: examples.some((example) => example.reports), accepts: examples.some((example) => !example.reports) }).toEqual({
          reports: !ACCEPTS_ONLY.has(id),
          accepts: true,
        })
      })

      it('holds examples that behave as their headings say', async () => {
        const rule = (await (PACKAGED_RULES[id] as () => Promise<{ default: RuleModule }>)()).default
        const wrong = examplesOf(text).flatMap((example) => {
          const messages = lintExample(rule, example)
          const fatal = messages.some((message) => message.startsWith('fatal: '))
          const reported = messages.some((message) => message.startsWith(`${id}: `))
          return fatal || reported !== example.reports ? [`${example.heading}: ${messages.join(' | ') || 'nothing reported'}`] : []
        })
        expect(wrong).toEqual([])
      })
    })
  }
})
