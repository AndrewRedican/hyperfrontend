/**
 * The rule catalogue of a lint package as one page: the families and their
 * counts, then each family with an index of its rules and every rule's own
 * document under a heading named by its id, with the facts the index records
 * written above it as a row of pills. A package opts in by keeping
 * `docs/rules/index.json` beside one document per rule.
 *
 * @module scripts/rule-catalogue
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { generateSlug } from '../src/lib/slug'

/** One rule as the package's index lists it. */
export interface CatalogueRule {
  /** The id a configuration names. */
  readonly id: string
  /** The family the catalogue groups it under. */
  readonly family: string
  /** The language it reads. */
  readonly language: 'code' | 'json' | 'markdown' | 'text'
  /** Whether `--fix` can apply its fixes. */
  readonly fixable: boolean
  /** The presets that turn it on, each with the severity it sets. */
  readonly presets: Readonly<Record<string, 'warn' | 'error'>>
}

/** One family of rules, as the page introduces it. */
interface CatalogueFamily {
  /** The family's id in the index. */
  readonly id: string
  /** The section's title. */
  readonly title: string
  /** One sentence under the title: where the rules come from and which preset turns them on. */
  readonly about: string
}

/** Where the package's own page documents its exports. */
const PACKAGE_DOCS = 'https://www.hyperfrontend.dev/docs/libraries/linter/'

/**
 * A link to a preset on the package's page.
 *
 * @param name - The preset's export name
 * @returns Markdown for the link
 */
function presetLink(name: string): string {
  return `[\`${name}\`](${PACKAGE_DOCS}#api-${name})`
}

/** The families in the order the page lists them. */
const FAMILIES: readonly CatalogueFamily[] = [
  {
    id: 'core',
    title: 'Core rules',
    about: `Reimplemented from [ESLint](https://eslint.org/docs/latest/rules/)'s own rules. ${presetLink('CODE_RULES')} turns on the ones \`eslint:recommended\` does.`,
  },
  {
    id: 'typescript',
    title: 'TypeScript rules',
    about: `Reimplemented from [typescript-eslint](https://typescript-eslint.io/rules/), without type information. ${presetLink('CODE_RULES')} turns on the ones its \`recommended\` configuration does.`,
  },
  {
    id: 'jsdoc',
    title: 'JSDoc rules',
    about: `Reimplemented from [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc). ${presetLink('JSDOC_RULES')} turns on the ones its \`recommended\` configuration does.`,
  },
  {
    id: 'react',
    title: 'React rules',
    about: `Reimplemented from [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react). ${presetLink('REACT_RULES')} turns on the ones its \`recommended\` configuration does.`,
  },
  {
    id: 'react-hooks',
    title: 'React hooks rules',
    about: `Reimplemented from [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks). ${presetLink('REACT_RULES')} turns both on.`,
  },
  {
    id: 'package-json',
    title: 'package.json rules',
    about:
      'Reimplemented from [eslint-plugin-package-json](https://github.com/JoshuaKGoldberg/eslint-plugin-package-json). No preset turns it on; name it by id.',
  },
  {
    id: 'conventions',
    title: 'Convention rules',
    about:
      "The package's own rules, written for the hyperfrontend repository and general enough to ship. No preset turns them on; name each by id.",
  },
]

/** The files each language reads, as the page names them. */
const FILES: Readonly<Record<CatalogueRule['language'], string>> = {
  code: 'TypeScript, JavaScript',
  json: 'JSON',
  markdown: 'Markdown',
  text: 'YAML, as text',
}

/** The mark a fixable rule carries in the index tables. */
const FIX_MARK = '🔧'

/**
 * The anchor a rule's heading gets on the page.
 *
 * @param id - The id a configuration names the rule by, such as `typescript/no-namespace`
 * @returns The fragment, without `#`
 */
export function ruleAnchor(id: string): string {
  return generateSlug(id)
}

/**
 * The row of facts written above a rule's document.
 *
 * The markup is HTML because the facts are pills, and a pill is a look the
 * stylesheet gives a class (`rule-facts` and `rule-fact` in `globals.css`).
 *
 * @param rule - The index entry whose language, fix and presets the row states
 * @returns One paragraph of HTML
 */
function factsOf(rule: CatalogueRule): string {
  const presets = entries(rule.presets).map(([name]) => `<span class="rule-fact rule-fact--preset">Preset <code>${name}</code></span>`)
  return [
    '<p class="rule-facts">',
    `<span class="rule-fact">Reads ${FILES[rule.language]}</span>`,
    rule.fixable ? `<span class="rule-fact rule-fact--fix">${FIX_MARK} Fixable with <code>--fix</code></span>` : '',
    presets.length === 0 ? '<span class="rule-fact rule-fact--muted">No preset: turn it on by id</span>' : presets.join(''),
    '</p>',
  ].join('')
}

/**
 * A line with every link to another rule's document, or to a section of this
 * document, pointed at a heading on the page.
 *
 * @param line - A line of a rule's document, outside code
 * @param id - The id of the rule the line belongs to
 * @returns The line with `](./other.md)`, `](../family/other.md)` and `](#section)` links rewritten
 */
function linkToHeadings(line: string, id: string): string {
  const directory = posix.dirname(id)
  let rewritten = ''
  let rest = line
  for (let open = rest.indexOf(']('); open !== -1; open = rest.indexOf('](')) {
    const close = rest.indexOf(')', open)
    if (close === -1) break
    const destination = rest.slice(open + 2, close).split('#')[0] as string
    const relative = destination.startsWith('./') || destination.startsWith('../')
    rewritten += rest.slice(0, open + 2)
    if (relative && destination.endsWith('.md')) {
      rewritten += `#${ruleAnchor(posix.normalize(posix.join(directory, destination.slice(0, -3))))}`
    } else if (destination === '' && rest.slice(open + 2, close).startsWith('#')) {
      // why: a document's own sections are headings every other rule has too, so a link to one of them lands on the rule instead of on the first rule's section of that name
      rewritten += `#${ruleAnchor(id)}`
    } else {
      rewritten += rest.slice(open + 2, close)
    }
    rest = rest.slice(close)
  }
  return rewritten + rest
}

/**
 * A rule's document with its title dropped, its sections moved under the
 * rule's heading, and its links pointed at headings on the page.
 *
 * @param text - The document as written, opening with `# <id>`
 * @param id - The rule's id, which places the document among the others
 * @returns The body, its `##` headings demoted to `####`
 */
function bodyOf(text: string, id: string): string {
  const lines = text.split(/\r?\n/).slice(1)
  let fenced = false
  return lines
    .map((line) => {
      if (line.startsWith('```')) fenced = !fenced
      if (fenced) return line
      const linked = linkToHeadings(line, id)
      return /^#{2,3} /.test(linked) ? `##${linked}` : linked
    })
    .join('\n')
    .trim()
}

/**
 * The preset names that turn on any of a list of rules.
 *
 * @param rules - The index entries whose presets are collected
 * @returns The names, each once, in the order they first appear
 */
function presetNamesOf(rules: readonly CatalogueRule[]): string[] {
  return [...createSet(rules.flatMap((rule) => entries(rule.presets).map(([name]) => name)))]
}

/**
 * The index table of a family's rules: one column per preset that names any of them, marked on the rules it turns on.
 *
 * @param rules - The rules, in the order the table lists them
 * @returns Markdown for the table
 */
function indexOf(rules: readonly CatalogueRule[]): string[] {
  const presets = presetNamesOf(rules)
  return [
    `| Rule | Reads | ${FIX_MARK} |${presets.map((name) => ` \`${name}\` |`).join('')}`,
    `| ---- | ----- | :-: |${presets.map(() => ' :-: |').join('')}`,
    ...rules.map(
      (rule) =>
        `| [\`${rule.id}\`](#${ruleAnchor(rule.id)}) | ${FILES[rule.language]} | ${rule.fixable ? FIX_MARK : ''} |${presets.map((name) => ` ${name in rule.presets ? '✅' : ''} |`).join('')}`
    ),
  ]
}

/**
 * The table of families that opens the page.
 *
 * @param rules - Every rule in the index
 * @returns Markdown for the table
 */
function familiesOf(rules: readonly CatalogueRule[]): string[] {
  const rows = FAMILIES.flatMap((family) => {
    const members = rules.filter((rule) => rule.family === family.id)
    if (members.length === 0) return []
    const fixable = members.filter((rule) => rule.fixable).length
    return [
      `| [${family.title}](#${generateSlug(family.title)}) | ${members.length} | ${fixable} | ${presetNamesOf(members).map(presetLink).join(', ')} |`,
    ]
  })
  return ['| Family | Rules | Fixable | Preset |', '| ------ | ----: | ------: | ------ |', ...rows]
}

/**
 * The catalogue page of a package, or null when it keeps no rule index.
 *
 * @param packageRoot - The package's directory, absolute
 * @param packageName - The npm name the page introduces
 * @returns The page's Markdown
 * @throws {Error} When the index names a rule whose document is missing
 */
export function ruleCatalogue(packageRoot: string, packageName: string): string | null {
  const directory = join(packageRoot, 'docs', 'rules')
  const indexFile = join(directory, 'index.json')
  if (!existsSync(indexFile)) return null
  const rules = parse(readFileSync(indexFile, 'utf8')) as CatalogueRule[]
  const sections: string[] = [
    '# Rule catalogue',
    '',
    `Every rule \`${packageName}\` ships, by family. A rule runs once a configuration block turns it on by its id, and a preset turns on every rule marked with it. Each rule's heading is a stable link target, so \`#${ruleAnchor('typescript/no-namespace')}\` always finds \`typescript/no-namespace\`.`,
    '',
    ...familiesOf(rules),
    '',
    `${FIX_MARK} marks a rule whose fixes \`--fix\` applies. Suggestions, for changes that need judgement, appear in the JSON report and are described under the rules that offer them.`,
  ]
  for (const family of FAMILIES) {
    const members = rules.filter((rule) => rule.family === family.id)
    if (members.length === 0) continue
    sections.push('', `## ${family.title}`, '', family.about, '', ...indexOf(members))
    for (const rule of members) {
      const file = join(directory, `${rule.id}.md`)
      if (!existsSync(file)) throw createError(`The rule index names ${rule.id}, but ${file} does not exist`)
      sections.push('', '---', '', `### \`${rule.id}\``, '', factsOf(rule), '', bodyOf(readFileSync(file, 'utf8'), rule.id))
    }
  }
  return `${sections.join('\n')}\n`
}
