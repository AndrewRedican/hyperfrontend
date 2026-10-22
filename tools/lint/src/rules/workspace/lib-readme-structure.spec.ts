import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './lib-readme-structure.ts'

/** An error over the whole document. */
interface WholeError {
  /** The message. */
  readonly message: string
  /** Line one. */
  readonly line: number
  /** Column one. */
  readonly column: number
  /** The line after the last. */
  readonly endLine: number
  /** Column one again. */
  readonly endColumn: number
}

/** An error at a line, with no end. */
interface LineError {
  /** The message. */
  readonly message: string
  /** The line. */
  readonly line: number
  /** Column zero. */
  readonly column: number
  /** No end line. */
  readonly endLine: null
  /** No end column. */
  readonly endColumn: null
}

const workspace = createMarkdownWorkspace()
workspace.write('libs/pub/package.json', '{ "name": "@s/pub" }')
workspace.write(
  'libs/unnamed/project.json',
  '{ "name": "lib-unnamed", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
const README = workspace.libraryFile('README.md')

const BADGE_URLS = [
  'https://img.shields.io/github/actions/workflow/status/o/r/ci.yml',
  'https://codecov.io/gh/o/r/badge.svg',
  'https://img.shields.io/npm/v/x',
  'https://bundlephobia.com/x',
  'https://img.shields.io/all-contributors',
  'https://img.shields.io/license-MIT',
  'https://img.shields.io/npm/dm/x',
  'https://img.shields.io/github/stars/o/r',
  'https://img.shields.io/badge/node-%3E%3D18',
  'https://img.shields.io/badge/tree%20shakeable-yes',
]
const badges = (urls: readonly string[] = BADGE_URLS): string =>
  `<p align="center">\n${urls.map((url) => `  <img src="${url}">`).join('\n')}\n</p>\n`
const LINKS =
  '• 👉 See [**documentation**](./relative/) first\n• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/pub/)\n• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40s%2Fpub)\n'
const FEATURES = [
  '- **Fast** - Renders every frame within its budget.',
  '- **Small**: Ships without a single dependency.',
  '- **Typed** - Exposes complete type declarations.',
]
const SECTIONS = [
  '## Why Use @hyperfrontend/pub?\n\nBecause.',
  '## Installation\n\nnpm i',
  '## Quick Start\n\nCode.',
  '## API Overview\n\nTable.',
  '## Compatibility\n\nTable.',
]

// why: a complete readme; positions are computed from the text, never counted by hand.
const readme = (
  features: readonly string[] = FEATURES,
  sections: readonly string[] = SECTIONS,
  head = `# @hyperfrontend/pub\n\n${badges()}\nShort description.\n\n${LINKS}`
): string => `${head}\n## What is @hyperfrontend/pub?\n\nIntro.\n\n### Key Features\n\n${features.join('\n')}\n\n${sections.join('\n\n')}\n`
const whole = (text: string, message: string): WholeError => ({
  message,
  line: 1,
  column: 1,
  endLine: text.split(/\r?\n/).length,
  endColumn: 1,
})
const at = (text: string, needle: string, message: string): LineError => ({
  message,
  line: text.split(/\r?\n/).findIndex((line) => line.includes(needle)) + 1,
  column: 0,
  endLine: null,
  endColumn: null,
})

const COMPLETE = readme()
const NOTHING = 'Just words.\n'
const OTHER_TITLE = readme(FEATURES, SECTIONS, `# Other\n\n${badges(BADGE_URLS.slice(0, 7))}\n## Heading first\n\n${LINKS}`)
const LOOKALIKE = COMPLETE.replace('https://codecov.io/', 'https://codecov.io.example/').replace(
  'https://bundlephobia.com/x',
  'https://[bundlephobia.com]/x'
)
const ELSEWHERE = COMPLETE.replace('https://www.hyperfrontend.dev/docs/libraries/pub/', 'https://example.com/docs/').replace(
  'package=%40s%2Fpub',
  'package=other'
)
const DISORDERED = readme(FEATURES, [
  '## Why Use @hyperfrontend/pub?\n\nBecause.',
  '## Quick Start\n\nCode.',
  '## Installation',
  '## API Overview\n\nTable.',
  '## Compatibility\n\nTable.',
])
const NO_FEATURES = COMPLETE.replace('### Key Features', '### Highlights')
const PROSE = readme(['Prose instead.'])
const SHAPES = readme([
  '- No label at all here',
  '- **Bare**',
  '- **Short** - Tiny.',
  `- **${'L'.repeat(49)}** - Explains itself at some length indeed.`,
  '  - **Nested** - Not a top-level bullet of the list.',
  '~~~',
  'inside a closed fence',
  '~~~',
  'A prose line that runs far past sixty characters, so the message quotes no more than its head',
  '```ts',
  'const inside = 1',
])
const FEW = readme(FEATURES.slice(0, 2))
const MANY = readme(Array.from({ length: 13 }, (_, index) => `- **Feature ${index}** - Explains what it gives the reader.`))
const DOCS_MESSAGE =
  'README must have a documentation link in format: • 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)'
const GUIDES_MESSAGE =
  'README must link its guides and tutorials in format: • 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40s%2Fpub). The link stays valid while the package has no guides: it addresses the filter, so guides written later surface without another README change.'
const notAList = (line: string): string =>
  `Key Features must be a flat bullet list, and '${line}' is not a top-level bullet. Rewrite it as a '- **Label** - explanation' bullet, or move it under a heading of its own.`

testRule(rule, {
  valid: [
    { name: 'a complete readme', path: README, text: COMPLETE },
    {
      name: 'a package without a manifest name, which needs no guides link',
      path: join(workspace.root, 'libs', 'unnamed', 'README.md'),
      text: COMPLETE.replace(/• 👉 See \[\*\*guides.*\n/, ''),
    },
    { name: 'a markdown file that is no readme', path: workspace.libraryFile('ARCHITECTURE.md'), text: '# Nothing\n' },
    { name: 'a readme outside a publishable library', path: workspace.internalFile('README.md'), text: '# Nothing\n' },
    {
      name: 'features with linked and coded labels, comments and a star marker',
      path: README,
      text: readme([
        '<!-- a note\n   over two lines -->',
        '* **[Linked](x) `code`** - Renders every frame within budget.',
        ...FEATURES.slice(1),
      ]),
    },
  ],
  invalid: [
    {
      name: 'a readme with nothing in it',
      path: README,
      text: NOTHING,
      errors: [
        'README must start with a title in format: # @hyperfrontend/<package-name>',
        'README must have a badges block with centered paragraphs (<p align="center">)',
        DOCS_MESSAGE,
        GUIDES_MESSAGE,
        "README must have section: 'What is @hyperfrontend/<name>?'",
        "README must have section: 'Why Use @hyperfrontend/<name>?'",
        "README must have section: 'Installation'",
        "README must have section: 'Quick Start'",
        "README must have section: 'API Overview'",
        "README must have section: 'Compatibility'",
      ].map((message) => whole(NOTHING, message)),
    },
    {
      name: 'a title outside the scope, missing badges and a heading where the description should be',
      path: README,
      text: OTHER_TITLE,
      errors: [
        "README title must be in format '# @hyperfrontend/<package-name>'. Found: 'Other'",
        'Missing required badge: GitHub stars badge',
        'Missing required badge: Node version badge',
        'Missing required badge: Tree-shakeable badge',
        'README must have a short description paragraph after the badges block',
      ].map((message) => whole(OTHER_TITLE, message)),
    },
    {
      name: 'badges from a lookalike host or behind an unparsable URL',
      path: README,
      text: LOOKALIKE,
      errors: ['Missing required badge: Coverage badge', 'Missing required badge: Bundle size badge'].map((message) =>
        whole(LOOKALIKE, message)
      ),
    },
    {
      name: 'links that point elsewhere',
      path: README,
      text: ELSEWHERE,
      errors: [DOCS_MESSAGE, GUIDES_MESSAGE].map((message) => whole(ELSEWHERE, message)),
    },
    {
      name: 'an empty section and two out of order',
      path: README,
      text: DISORDERED,
      errors: [
        "README section 'Installation' must have content",
        "README section 'Installation' should appear before 'Quick Start' (expected order: What is, Why Use, Installation, Quick Start, API Overview, Compatibility)",
      ].map((message) => whole(DISORDERED, message)),
    },
    {
      name: 'a What is section without a Key Features subsection',
      path: README,
      text: NO_FEATURES,
      errors: [whole(NO_FEATURES, "README must have subsection 'Key Features' under 'What is @hyperfrontend/pub?'")],
    },
    {
      name: 'a Key Features section without bullets',
      path: README,
      text: PROSE,
      errors: [
        whole(PROSE, "Key Features section must have a bullet list (lines starting with '- **')"),
        at(PROSE, 'Prose instead.', notAList('Prose instead.')),
      ],
    },
    {
      name: 'every shape a bullet can get wrong, with an unclosed fence reported once',
      path: README,
      text: SHAPES,
      errors: [
        at(
          SHAPES,
          'No label',
          "Key feature 'No label at all here' does not open with a bold label. Write it as '- **Label** - explanation' so the label can be read on its own."
        ),
        at(
          SHAPES,
          '**Bare**',
          "Key feature 'Bare' is a bare label. Follow it with an explanation, separated by ': ' or ' - ', saying what the feature gives the reader."
        ),
        at(
          SHAPES,
          '**Short**',
          "Key feature 'Short' explains itself in 5 characters, under the 20 required. Say what it does for the reader instead of restating the label."
        ),
        at(
          SHAPES,
          'LLLL',
          `Key feature label '${'L'.repeat(49)}' is 49 characters, past the 48 a label may use. Cut it back to a name and move the rest into the explanation after it.`
        ),
        at(SHAPES, '**Nested**', notAList('- **Nested** - Not a top-level bullet of the list.')),
        at(SHAPES, '~~~', notAList('~~~')),
        at(
          SHAPES,
          'A prose line',
          notAList(
            `${'A prose line that runs far past sixty characters, so the message quotes no more than its head'.slice(0, 60).trimEnd()}...`
          )
        ),
        at(SHAPES, '```ts', notAList('```ts')),
      ],
    },
    {
      name: 'too few features',
      path: README,
      text: FEW,
      errors: [
        at(
          FEW,
          '### Key Features',
          'Key Features lists 2 features, under the 3 a package needs to summarise itself. Add the features a reader would choose this package for.'
        ),
      ],
    },
    {
      name: 'too many features',
      path: README,
      text: MANY,
      errors: [
        at(
          MANY,
          '### Key Features',
          'Key Features lists 13 features, past the 12 a reader takes in at a glance. Keep the ones that decide adoption and let the sections below carry the rest.'
        ),
      ],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
