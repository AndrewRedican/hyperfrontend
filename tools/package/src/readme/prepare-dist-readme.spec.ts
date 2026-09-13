import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMediaCatalog } from './catalog'
import { prepareDistReadme } from './prepare-dist-readme'

const roots: string[] = []

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true })
  }
})

/** The options every preparation in this file shares, for one workspace root. */
interface Fixture {
  /** The workspace root. */
  workspaceRoot: string
  /** The package's source directory. */
  projectRoot: string
  /** The package's build output. */
  outputPath: string
}

/**
 * A throwaway workspace with one library, its build output, and a media tree.
 *
 * @param readme - The library's source readme, or undefined for a library with none.
 * @param media - Files to write under `assets/media`, by path.
 * @returns Where everything is.
 */
function workspace(readme: string | undefined, media: Record<string, string> = {}): Fixture {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'dist-readme-'))
  roots.push(workspaceRoot)
  const projectRoot = join(workspaceRoot, 'libs', 'utils', 'data')
  const outputPath = join(workspaceRoot, 'dist', 'libs', 'utils', 'data')
  mkdirSync(projectRoot, { recursive: true })
  mkdirSync(outputPath, { recursive: true })
  if (readme !== undefined) {
    writeFileSync(join(projectRoot, 'README.md'), readme)
    // why: the asset phase copies the source readme into the output before the transform runs, so the fixture starts from that state
    writeFileSync(join(outputPath, 'README.md'), readme)
  }
  for (const [path, content] of entries(media)) {
    const target = join(workspaceRoot, 'assets', 'media', path)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, content)
  }
  return { workspaceRoot, projectRoot, outputPath }
}

/**
 * The options for one preparation.
 *
 * @param fixture - Where everything is.
 * @returns Options naming the workspace's media tree and documentation.
 */
function optionsFor(fixture: Fixture) {
  return {
    ...fixture,
    mediaRoot: 'assets/media',
    publicBaseUrl: 'https://www.hyperfrontend.dev/media/',
    docsBaseUrl: 'https://www.hyperfrontend.dev/docs/libraries/',
  }
}

const SIDECAR = '{"profile":{"width":640,"height":360}}'

const SOURCE = [
  '# @hyperfrontend/data-utils',
  '',
  'Prose.',
  '',
  '<!-- hf:media start id="cycles" scene="data-utils-circular" docs="#api-locateCircularReference" alt="Every cycle at once" -->',
  '| Call | Finds |',
  '| --- | --- |',
  '<!-- hf:media end -->',
].join('\n')

describe('createMediaCatalog', () => {
  it('prefers the animation and falls back to a still', () => {
    const fixture = workspace(undefined, {
      'scene/hero.gif': '',
      'scene/hero.webp': '',
      'scene/hero.json': SIDECAR,
      'still-only/poster.png': '',
      'still-only/hero.json': SIDECAR,
    })
    const catalog = createMediaCatalog(join(fixture.workspaceRoot, 'assets', 'media'), 'https://cdn/')
    expect([catalog.resolve('scene', 'hero'), catalog.resolve('still-only', 'poster')]).toEqual([
      { url: 'https://cdn/scene/hero.gif', width: 640, height: 360 },
      { url: 'https://cdn/still-only/poster.png', width: 640, height: 360 },
    ])
  })

  it('never resolves a themed file', () => {
    const fixture = workspace(undefined, { 'scene/hero.dark.gif': '', 'scene/hero.light.gif': '', 'scene/hero.json': SIDECAR })
    const catalog = createMediaCatalog(join(fixture.workspaceRoot, 'assets', 'media'), 'https://cdn/')
    expect(() => catalog.resolve('scene', 'hero')).toThrow(/no hero\.gif, hero\.webp or hero\.png/)
  })

  it("reads the size off the viewport when there is no profile, preferring the asset's own record", () => {
    const fixture = workspace(undefined, {
      'scene/hero.gif': '',
      'scene/hero.json': '{"viewport":{"width":560,"height":315}}',
      'scene/other.json': SIDECAR,
    })
    const catalog = createMediaCatalog(join(fixture.workspaceRoot, 'assets', 'media'), 'https://cdn/')
    expect(catalog.resolve('scene', 'hero')).toEqual(expect.objectContaining({ width: 560, height: 315 }))
  })

  it('names what is missing', () => {
    const fixture = workspace(undefined, { 'scene/hero.gif': '', 'bare/hero.gif': '', 'sizeless/hero.gif': '', 'sizeless/hero.json': '{}' })
    const catalog = createMediaCatalog(join(fixture.workspaceRoot, 'assets', 'media'), 'https://cdn/')
    const attempts: ReadonlyArray<[string, string]> = [
      ['nope', 'hero'],
      ['scene', 'poster'],
      ['bare', 'hero'],
      ['sizeless', 'hero'],
    ]
    const reasons = attempts.map(([scene, asset]) => {
      try {
        catalog.resolve(scene, asset)
        return 'resolved'
      } catch (cause) {
        return cause instanceof Error ? cause.message : 'not an error'
      }
    })
    expect(reasons).toEqual([
      expect.stringContaining('no scene named "nope"'),
      expect.stringContaining('no poster.gif, poster.webp or poster.png'),
      expect.stringContaining('no audit record'),
      expect.stringContaining('neither a profile nor a viewport'),
    ])
  })
})

describe('prepareDistReadme', () => {
  it('writes the transformed readme into the output and leaves the source untouched', () => {
    const fixture = workspace(SOURCE, { 'data-utils-circular/hero.gif': '', 'data-utils-circular/hero.json': SIDECAR })
    const prepared = prepareDistReadme(optionsFor(fixture))
    expect({
      prepared,
      written: readFileSync(join(fixture.outputPath, 'README.md'), 'utf8'),
      source: readFileSync(join(fixture.projectRoot, 'README.md'), 'utf8'),
    }).toEqual({
      prepared: expect.objectContaining({
        path: join(fixture.outputPath, 'README.md'),
        docsLanding: 'https://www.hyperfrontend.dev/docs/libraries/utils/data/',
        outcome: expect.objectContaining({ replacements: [expect.objectContaining({ id: 'cycles' })] }),
      }),
      written: [
        '# @hyperfrontend/data-utils',
        '',
        'Prose.',
        '',
        '<p align="center">',
        '  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateCircularReference">',
        '    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/data-utils-circular/hero.gif" alt="Every cycle at once">',
        '  </a>',
        '</p>',
      ].join('\n'),
      source: SOURCE,
    })
  })

  it('writes a readme with no regions through unchanged', () => {
    const fixture = workspace('# @hyperfrontend/data-utils\n\nProse.\n')
    const prepared = prepareDistReadme(optionsFor(fixture))
    expect({ replacements: prepared?.outcome.replacements, written: readFileSync(join(fixture.outputPath, 'README.md'), 'utf8') }).toEqual({
      replacements: [],
      written: '# @hyperfrontend/data-utils\n\nProse.\n',
    })
  })

  it('does nothing for a package without a readme', () => {
    const fixture = workspace(undefined)
    expect([prepareDistReadme(optionsFor(fixture)), existsSync(join(fixture.outputPath, 'README.md'))]).toEqual([undefined, false])
  })

  it('removes the copied readme from the output when the transform fails', () => {
    const fixture = workspace(SOURCE)
    expect(() => prepareDistReadme(optionsFor(fixture))).toThrow(
      /Could not prepare .*README\.md: Region "cycles" \(line 5\): no scene named "data-utils-circular"/
    )
    expect([existsSync(join(fixture.outputPath, 'README.md')), existsSync(join(fixture.projectRoot, 'README.md'))]).toEqual([false, true])
  })

  it('refuses a package that does not live under libs', () => {
    const fixture = workspace(SOURCE)
    const elsewhere = join(fixture.workspaceRoot, 'apps', 'thing')
    mkdirSync(elsewhere, { recursive: true })
    writeFileSync(join(elsewhere, 'README.md'), '# thing')
    expect(() => prepareDistReadme({ ...optionsFor(fixture), projectRoot: elsewhere })).toThrow(/not under .*libs/)
  })

  it('reports an unreadable audit record', () => {
    const fixture = workspace(SOURCE, { 'data-utils-circular/hero.gif': '', 'data-utils-circular/hero.json': 'not json' })
    expect(() => prepareDistReadme(optionsFor(fixture))).toThrow(/Could not prepare/)
  })
})
