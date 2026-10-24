import type { ExpectedError, InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createDocsWorkspace } from './__test-utils__/docs-workspace.ts'
import rule from './lib-readme-media-regions.ts'

const root = createDocsWorkspace()
// why: a package outside the scope, in a workspace naming no repository, keeps its full name in the scenes it expects.
const BARE_DIR = createTempDir({
  prefix: 'lint-media-bare-',
  tree: {
    'nx.json': '{}',
    'libs/x/project.json': '{"projectType":"library","targets":{"build":{},"publish":{}}}',
    'libs/x/package.json': '{"name":"@ws/x"}',
  },
})
const BARE = BARE_DIR.path
const GAMMA = join(root, 'libs/gamma/README.md')

/**
 * A region's markers.
 *
 * @param attributes - The start marker's attributes, an alternative text added when they give none
 * @returns The two marker lines
 */
function region(attributes: string): string {
  return `<!-- hf:media start ${attributes}${attributes.includes('alt=') ? '' : ' alt="x"'} -->\n<!-- hf:media end -->`
}

const RUNTIMES = region('id="runtimes" scene="runtimes-gamma" asset="runtimes" docs="#compatibility" alt="x"')

/**
 * A case linting the gamma README.
 *
 * @param name - What the case shows
 * @param lines - The README, one entry per line
 * @returns The case
 */
function readme(name: string, lines: readonly string[]): RuleCase {
  return { name, path: GAMMA, root, text: lines.join('\n') }
}

/**
 * A case expecting reports, each on a whole line.
 *
 * @param name - What the case shows
 * @param lines - The README's lines
 * @param reports - Each report's 0-based line and message
 * @param path - The README, gamma's unless given
 * @returns The case
 */
function reported(name: string, lines: readonly string[], reports: readonly [number, string][], path = GAMMA): InvalidCase {
  const text = lines.join('\n')
  const split = text.split(/\r?\n/)
  const errors: ExpectedError[] = reports.map(([line, message]) => ({
    message,
    line: line + 1,
    column: 1,
    endLine: line + 1,
    endColumn: (split[line] as string).length + 1,
  }))
  return { name, path, root, text, errors }
}

const MISSING_REGION =
  'A publishable README declares a "runtimes" region naming scene "runtimes-gamma" and asset "runtimes", inside the Compatibility section, so the distribution readme carries the package runtimes.'

testRule(rule, {
  valid: [
    readme('a README with its runtimes region in the Compatibility section', [
      '# Gamma',
      '',
      '## Compatibility',
      '',
      RUNTIMES,
      '',
      '## Next',
    ]),
    readme('a region without a docs link, the README without a Compatibility section', [
      '# Gamma',
      region('id="runtimes" scene="runtimes-gamma" asset="runtimes"'),
    ]),
    { name: 'a file that is not a README', path: join(root, 'libs/gamma/GUIDE.md'), root, text: '# Guide' },
    { name: 'a README of a project that is not publishable', path: join(root, 'libs/gamma/src/README.md'), root, text: '# Source' },
    { name: 'a library without a package name', path: join(root, 'libs/epsilon/README.md'), root, text: '# Epsilon' },
    { name: 'a library outside the documented packages', path: join(root, 'plugins/plug/README.md'), root, text: '# Plug' },
  ],
  invalid: [
    reported('a README without the runtimes region', ['# Gamma'], [[0, MISSING_REGION]]),
    reported(
      'a runtimes region naming another scene',
      ['# Gamma', region('id="runtimes" scene="hero-gamma" asset="hero"')],
      [[1, 'Region "runtimes" must name scene "runtimes-gamma" and asset "runtimes".']]
    ),
    reported(
      'a runtimes region outside the Compatibility section',
      ['# Gamma', RUNTIMES, '## Compatibility', '### Detail'],
      [[1, 'Region "runtimes" belongs inside the Compatibility section.']]
    ),
    reported(
      'a runtimes region below the Compatibility section',
      ['# Gamma', '## Compatibility', '### Detail', RUNTIMES],
      [[3, 'Region "runtimes" belongs inside the Compatibility section.']]
    ),
    reported(
      'regions naming a banner, a missing scene, a file, an empty scene and a broken link',
      [
        '# Gamma',
        RUNTIMES,
        region('id="banner" scene="banner-gamma" asset="banner"'),
        region('id="a" scene="nope-scene"'),
        region('id="b" scene="not-a-scene"'),
        region('id="c" scene="empty-scene"'),
        region('id="d" scene="hero-gamma" docs="#nope"'),
        '<!-- hf:media start id="Bad" scene="x" alt="x" -->',
      ],
      [
        [
          3,
          'The build places the package banner in place of the title; remove this region, or the distribution readme shows the banner twice.',
        ],
        [5, 'No committed scene "nope-scene" under assets/media. Record it with the media tool, or correct the scene attribute.'],
        [7, 'No committed scene "not-a-scene" under assets/media. Record it with the media tool, or correct the scene attribute.'],
        [
          9,
          'Scene "empty-scene" has no portable hero.gif, hero.webp or hero.png. Record it, or correct the asset attribute; a themed file is never what a readme embeds.',
        ],
        [
          11,
          `The docs attribute of region "d" resolves to https://www.hyperfrontend.dev/docs/libraries/gamma/#nope, which does not resolve: libs/gamma/README.md has no heading with the anchor 'nope'`,
        ],
        [13, 'This media region cannot be read: id "Bad" must be lower-case words joined by single hyphens'],
      ]
    ),
    reported(
      'a library whose banner is not recorded',
      ['Intro', '# Delta'],
      [
        [0, MISSING_REGION.replaceAll('gamma', 'delta')],
        [
          1,
          'The distribution readme opens with the package banner in place of this title, and no portable banner.gif, banner.webp or banner.png is recorded under assets/media/banner-delta. Record it: npx nx media tool-media --scene=banner-delta',
        ],
      ],
      join(root, 'libs/delta/README.md')
    ),
    reported(
      'a library whose banner is not recorded and whose README has no title',
      ['Intro'],
      [
        [
          0,
          'The distribution readme opens with the package banner in place of this title, and no portable banner.gif, banner.webp or banner.png is recorded under assets/media/banner-delta. Record it: npx nx media tool-media --scene=banner-delta',
        ],
        [0, MISSING_REGION.replaceAll('gamma', 'delta')],
      ],
      join(root, 'libs/delta/README.md')
    ),
    {
      ...reported('a package outside the scope', ['# X'], []),
      path: join(BARE, 'libs/x/README.md'),
      root: BARE,
      errors: [
        {
          message:
            'The distribution readme opens with the package banner in place of this title, and no portable banner.gif, banner.webp or banner.png is recorded under assets/media/banner-@ws/x. Record it: npx nx media tool-media --scene=banner-@ws/x',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 4,
        },
        { message: MISSING_REGION.replaceAll('gamma', '@ws/x'), line: 1, column: 1, endLine: 1, endColumn: 4 },
      ],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    BARE_DIR.remove()
    expect(existsSync(root) || existsSync(BARE)).toBe(false)
  })
})
