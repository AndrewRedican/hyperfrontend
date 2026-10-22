/**
 * A publishable library README carries the structure the site and the registry render: the
 * scoped title, the badge block, the opening description, the documentation and guides links,
 * the required sections in order, and a Key Features list shaped as labelled bullets.
 *
 * @module rules/workspace/lib-readme-structure
 */

import type { RuleContext } from '../../engine/rule.ts'
import type { MarkdownNode } from '../../markdown/model.ts'
import { basename, dirname } from 'node:path'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { defineRule } from '../../engine/rule.ts'
import { keyFeatureFindings } from './shared/key-features.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'
import { BADGE_MARKS, badgeBlock, carriesBadge, shortDescription } from './shared/readme.ts'

/** A heading and the content under it. */
interface Section {
  /** The heading level. */
  readonly level: number
  /** The heading text. */
  readonly title: string
  /** The 1-based line of the heading. */
  readonly startLine: number
  /** The 1-based line the section ends on. */
  readonly endLine: number
  /** The content under the heading, trimmed. */
  readonly content: string
}

/** A heading before its section is delimited. */
interface Heading {
  /** The heading level. */
  readonly level: number
  /** The heading text. */
  readonly title: string
  /** The 1-based line of the heading. */
  readonly startLine: number
}

/** A required section that was found, by its place among the level-two sections. */
interface Found {
  /** The name shown in messages. */
  readonly name: string
  /** The section's index among the level-two sections. */
  readonly index: number
}

/** A section the README must carry, by the pattern its heading matches. */
interface Required {
  /** What the heading must match. */
  readonly pattern: RegExp
  /** The name shown in messages. */
  readonly name: string
}

const SCOPE = '@hyperfrontend/'
const DOCS_ORIGIN = 'https://www.hyperfrontend.dev'
const DOCS_PATH = '/docs/'
const GUIDES_PATH = '/docs/guides/'

/** The badges a README carries, in the order their absence is reported. */
const BADGE_NAMES = [
  'Build badge',
  'Coverage badge',
  'npm version badge',
  'Bundle size badge',
  'Contributors badge',
  'License badge',
  'npm downloads badge',
  'GitHub stars badge',
  'Node version badge',
  'Tree-shakeable badge',
]

/** The level-two sections, in order. */
const REQUIRED_SECTIONS: readonly Required[] = [
  { pattern: /^what is @hyperfrontend\//i, name: 'What is @hyperfrontend/<name>?' },
  { pattern: /^why use @hyperfrontend\//i, name: 'Why Use @hyperfrontend/<name>?' },
  { pattern: /^installation$/i, name: 'Installation' },
  { pattern: /^quick start$/i, name: 'Quick Start' },
  { pattern: /^api overview$/i, name: 'API Overview' },
  { pattern: /^compatibility$/i, name: 'Compatibility' },
]

const KEY_FEATURES = /^key features$/i
const KEY_FEATURES_PARENT = /^what is/i

/**
 * The sections of a document: every ATX heading with the content up to the next heading of its
 * level or above.
 *
 * @param lines - The document's lines
 * @returns The sections in order
 */
function sectionsOf(lines: readonly string[]): Section[] {
  const headings: Heading[] = []
  lines.forEach((line, index) => {
    let level = 0
    while (level < line.length && level < 6 && line[level] === '#') level += 1
    if (level > 0 && line[level] === ' ') headings.push({ level, title: line.slice(level + 1).trim(), startLine: index + 1 })
  })
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
    const endLine = next === undefined ? lines.length : next.startLine - 1
    return { ...heading, endLine, content: lines.slice(heading.startLine, endLine).join('\n').trim() }
  })
}

/**
 * The URLs of the Markdown links on a line, parsed; an unparsable one is left out.
 *
 * @param line - The line being read for links
 * @returns The parsed targets
 */
function linkUrls(line: string): URL[] {
  const urls: URL[] = []
  let from = 0
  for (;;) {
    const open = line.indexOf('](', from)
    if (open === -1) return urls
    const close = line.indexOf(')', open + 2)
    if (close === -1) return urls
    try {
      urls.push(createURL(line.slice(open + 2, close)))
    } catch {
      // why: a relative or malformed target is no site link, and the line is read for site links only.
    }
    from = close + 1
  }
}

/**
 * Whether a line is the arrow line linking the documentation site.
 *
 * @param line - The line being read for links
 * @param matches - What the linked URL must satisfy
 * @returns True when the line carries the bullet, the arrow and such a link
 */
function isArrowLink(line: string, matches: (url: URL) => boolean): boolean {
  return line.includes('•') && line.includes('👉') && linkUrls(line).some(matches)
}

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/lib-readme-structure',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    const path = context.file.path
    const root = dirname(path)
    if (basename(path) !== 'README.md' || !isPublishableLibrary(root)) return {}
    return {
      root(node) {
        const { start, end } = node.position
        const whole = {
          start: start.offset,
          end: end.offset,
          at: { line: start.line, column: start.column, endLine: end.line, endColumn: end.column },
        }
        const report = (message: string): void => context.report({ ...whole, message })
        const content = context.file.text
        const lines = content.split(/\r?\n/)
        const title = lines.find((line) => line.startsWith('# '))
        if (title === undefined) report('README must start with a title in format: # @hyperfrontend/<package-name>')
        else if (!title.slice(2).trim().startsWith(SCOPE) || title.slice(2).trim().length <= SCOPE.length) {
          report(`README title must be in format '# @hyperfrontend/<package-name>'. Found: '${title.slice(2).trim()}'`)
        }
        const badges = badgeBlock(content)
        if (badges === null) report('README must have a badges block with centered paragraphs (<p align="center">)')
        else
          BADGE_MARKS.forEach((mark, index) => carriesBadge(badges.text, mark) || report(`Missing required badge: ${BADGE_NAMES[index]}`))
        if (shortDescription(content, badges?.endLine ?? 0) === null)
          report('README must have a short description paragraph after the badges block')
        if (
          !lines.some(
            (line) =>
              line.includes('**documentation**') &&
              isArrowLink(line, (url) => url.origin === DOCS_ORIGIN && url.pathname.startsWith(DOCS_PATH))
          )
        ) {
          report(
            'README must have a documentation link in format: • 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)'
          )
        }
        const packageName = readPackageFile(root)?.name
        if (
          typeof packageName === 'string' &&
          packageName !== '' &&
          !lines.some((line) =>
            isArrowLink(
              line,
              (url) => url.origin === DOCS_ORIGIN && url.pathname === GUIDES_PATH && url.searchParams.get('package') === packageName
            )
          )
        ) {
          report(
            `README must link its guides and tutorials in format: • 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=${encodeURIComponent(packageName)}). The link stays valid while the package has no guides: it addresses the filter, so guides written later surface without another README change.`
          )
        }
        const sections = sectionsOf(lines)
        const level2 = sections.filter((section) => section.level === 2)
        const found: Found[] = []
        for (const required of REQUIRED_SECTIONS) {
          const section = level2.find((candidate) => required.pattern.test(candidate.title))
          if (section === undefined) {
            report(`README must have section: '${required.name}'`)
            continue
          }
          found.push({ name: required.name, index: level2.indexOf(section) })
          if (section.content === '') report(`README section '${required.name}' must have content`)
        }
        found.forEach((current, index) => {
          const next = found[index + 1]
          if (next !== undefined && current.index > next.index) {
            report(
              `README section '${current.name}' should appear before '${next.name}' (expected order: What is, Why Use, Installation, Quick Start, API Overview, Compatibility)`
            )
          }
        })
        const parent = level2.find((section) => KEY_FEATURES_PARENT.test(section.title))
        if (parent === undefined) return
        const features = sections.find(
          (section) =>
            section.level === 3 &&
            section.startLine > parent.startLine &&
            section.startLine < parent.endLine &&
            KEY_FEATURES.test(section.title)
        )
        if (features === undefined) {
          report(`README must have subsection 'Key Features' under '${parent.title}'`)
          return
        }
        if (!features.content.split(/\r?\n/).some((line) => line.trimStart().startsWith('- **')))
          report("Key Features section must have a bullet list (lines starting with '- **')")
        let offset = 0
        const offsets = lines.map((line) => {
          const at = offset
          offset += line.length + 1
          return at
        })
        for (const problem of keyFeatureFindings(lines, features.startLine, features.endLine)) {
          context.report({ start: offsets[problem.line - 1], message: problem.message, at: { line: problem.line, column: 0 } })
        }
      },
    }
  },
})
