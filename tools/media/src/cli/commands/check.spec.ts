import type { AssetSidecar, VariantRecord } from '../../models/report'
import type { SceneWorkspace } from '../../scene/__test-utils__/scene-dir'
import { after as afterAll, before as beforeAll } from 'node:test'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { hashScene } from '../../report/sidecar'
import { browserSceneSource, createSceneWorkspace, scriptedSceneSource } from '../../scene/__test-utils__/scene-dir'
import { runCheck } from './check'

/** The fields every fixture record shares. */
const RECORD_BASE = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  sourceUrl: 'stage:dot',
  profile: { id: 'compact', intent: '', width: 640, height: 360, scale: 2, fps: 6 },
  viewport: { width: 640, height: 360 },
  record: { settleMs: 0, durationMs: 1_000 },
  startMs: 0,
  browser: { name: 'chromium', version: '1' },
  determinism: {},
  console: { errors: 0, warnings: 0, pageErrors: 0 },
}

/** Ways one fixture scene can be set up. */
interface Fixture {
  /** The slug, which names the scene file and its output directory. */
  slug: string
  /** Scene fields beyond the slug, as source. */
  fields?: string
  /** The variants the record lists, or undefined for a browser-style record with none. */
  variants?: readonly VariantRecord[]
  /** Files to write into the output directory, by name, as text of the stated length. */
  files?: Record<string, number>
  /** Whether to write the record with a stale scene digest. */
  stale?: boolean
  /** Whether to leave the record out altogether. */
  noRecord?: boolean
  /** Top-level animation size, for a browser-style record. */
  bytes?: number
  /** Whether the scene is a browser scene rather than a scripted one. */
  browser?: boolean
  /** Stills a browser-style record lists at its top level. */
  stills?: AssetSidecar['stills']
}

/**
 * Write one scene, its assets and its audit record into the workspace.
 *
 * @param workspace - Where to write.
 * @param fixture - What to write.
 */
function setUp(workspace: SceneWorkspace, fixture: Fixture): void {
  const fields = `slug: '${fixture.slug}', ${fixture.fields ?? "outputs: ['gif', 'still'],"}`
  const filePath = workspace.writeScene(
    `${fixture.slug}.scene.ts`,
    fixture.browser === true ? browserSceneSource(fields) : scriptedSceneSource(`${fields} profile: 'compact',`)
  )
  for (const [name, length] of entries(fixture.files ?? {})) {
    workspace.writeAsset(fixture.slug, name, 'x'.repeat(length))
  }
  if (fixture.noRecord === true) {
    return
  }
  const first = fixture.variants?.[0]
  const sidecar: AssetSidecar = {
    ...RECORD_BASE,
    slug: fixture.slug,
    asset: first?.asset ?? 'hero.gif',
    sceneHash: fixture.stale === true ? '0000000000000000' : hashScene(filePath),
    ...(fixture.bytes === undefined ? {} : { bytes: fixture.bytes }),
    ...(fixture.stills === undefined ? {} : { stills: fixture.stills }),
    ...(fixture.variants === undefined ? {} : { variants: fixture.variants }),
  }
  workspace.writeAsset(fixture.slug, 'hero.json', sidecar)
}

describe('runCheck', () => {
  let workspace: SceneWorkspace

  beforeAll(() => {
    workspace = createSceneWorkspace()
    setUp(workspace, {
      slug: 'good',
      variants: [
        { theme: 'portable', asset: 'hero.gif', bytes: 900, maxBytes: 1_000, stills: [{ asset: 'poster.webp', bytes: 50, maxBytes: 100 }] },
        {
          theme: 'dark',
          asset: 'hero.dark.gif',
          bytes: 1_500,
          maxBytes: 2_000_000,
          stills: [{ asset: 'poster.dark.webp', bytes: 50, maxBytes: 0 }],
        },
      ],
      files: { 'hero.gif': 900, 'hero.dark.gif': 1_500, 'poster.webp': 50, 'poster.dark.webp': 50 },
    })
    setUp(workspace, { slug: 'no-record', noRecord: true })
    setUp(workspace, {
      slug: 'stale',
      stale: true,
      variants: [
        { theme: 'portable', asset: 'hero.gif', bytes: 10 },
        { theme: 'dark', asset: 'hero.dark.gif', bytes: 10 },
      ],
      files: { 'hero.gif': 10, 'hero.dark.gif': 10 },
    })
    setUp(workspace, {
      slug: 'missing-variant',
      variants: [{ theme: 'portable', asset: 'hero.gif', bytes: 10 }],
      files: { 'hero.gif': 10 },
    })
    setUp(workspace, {
      slug: 'subset',
      fields: "outputs: ['gif', 'still'], themes: ['dark'],",
      variants: [{ theme: 'dark', asset: 'hero.dark.gif', bytes: 10 }],
      files: { 'hero.dark.gif': 10 },
    })
    setUp(workspace, { slug: 'unconfigured', fields: "outputs: ['gif', 'still'], themes: ['light', 'dark'],", variants: [] })
    setUp(workspace, {
      slug: 'over-budget',
      variants: [
        { theme: 'portable', asset: 'hero.gif', bytes: 8_192 },
        { theme: 'dark', asset: 'hero.dark.gif', bytes: 10 },
      ],
      files: { 'hero.gif': 8_192, 'hero.dark.gif': 10 },
    })
    setUp(workspace, {
      slug: 'drifted',
      variants: [
        { theme: 'portable', asset: 'hero.gif', bytes: 10 },
        { theme: 'dark', asset: 'hero.dark.gif', bytes: 4_096 },
      ],
      files: { 'hero.gif': 10, 'hero.dark.gif': 2_048 },
    })
    setUp(workspace, {
      slug: 'gone',
      variants: [
        { theme: 'portable', asset: 'hero.gif', bytes: 10 },
        { theme: 'dark', asset: 'hero.dark.gif', bytes: 10 },
      ],
      files: { 'hero.gif': 10 },
    })
    setUp(workspace, {
      slug: 'no-animation',
      variants: [{ theme: 'portable' }, { theme: 'dark', asset: 'hero.dark.gif', bytes: 10 }],
      files: { 'hero.dark.gif': 10 },
    })
    setUp(workspace, {
      slug: 'stills',
      variants: [
        {
          theme: 'portable',
          asset: 'hero.gif',
          bytes: 10,
          stills: [
            { asset: 'poster.webp', bytes: 5_120, maxBytes: 4_096 },
            { asset: 'lost.webp', bytes: 1, maxBytes: 0 },
          ],
        },
        { theme: 'dark', asset: 'hero.dark.gif', bytes: 10, stills: [{ asset: 'poster.dark.webp', bytes: 60, maxBytes: 0 }] },
      ],
      files: { 'hero.gif': 10, 'hero.dark.gif': 10, 'poster.webp': 5_120, 'poster.dark.webp': 50 },
    })
    setUp(workspace, {
      slug: 'browser-good',
      browser: true,
      bytes: 300,
      stills: [{ asset: 'poster.webp', bytes: 20, maxBytes: 0 }],
      files: { 'hero.gif': 300, 'poster.webp': 20 },
    })
    setUp(workspace, {
      slug: 'browser-still',
      browser: true,
      fields: "outputs: ['still'],",
      stills: [{ asset: 'poster.webp', bytes: 20, maxBytes: 10 }],
      files: { 'poster.webp': 20 },
    })
    setUp(workspace, { slug: 'browser-gone', browser: true, bytes: 300, files: {} })
    setUp(workspace, { slug: 'browser-unsized', browser: true, files: { 'hero.gif': 2_048 } })
    setUp(workspace, { slug: 'pre-variant', files: { 'hero.gif': 10 } })
    setUp(workspace, { slug: 'themeless', fields: "outputs: ['gif'], themes: [],", variants: [] })
  })

  afterAll(() => {
    workspace.remove()
  })

  it('counts every scene it examined', async () => {
    expect((await runCheck(workspace.config, '')).checked).toBe(17)
  })

  it('finds nothing wrong with a scene whose variants are all present, sized as recorded and in budget', async () => {
    expect(await runCheck(workspace.config, 'good')).toEqual({ checked: 1, issues: [] })
  })

  it('asks for a recording when there is no audit record', async () => {
    expect((await runCheck(workspace.config, 'no-record')).issues).toEqual([
      { slug: 'no-record', reason: 'no readable audit record for no-record. Run: nx media tool-media --scene=no-record' },
    ])
  })

  it('notices the scene has changed since it was recorded', async () => {
    expect((await runCheck(workspace.config, 'stale')).issues).toEqual([
      { slug: 'stale', reason: 'the scene changed since hero.gif was produced. Run: nx media tool-media --scene=stale' },
    ])
  })

  it('names a configured variant the record never mentions', async () => {
    expect((await runCheck(workspace.config, 'missing-variant')).issues).toEqual([
      { slug: 'missing-variant', reason: 'no dark variant was recorded. Run: nx media tool-media --scene=missing-variant' },
    ])
  })

  it('checks only the variants a scene opts into', async () => {
    expect(await runCheck(workspace.config, 'subset')).toEqual({ checked: 1, issues: [] })
  })

  it('reports a theme the scene asks for that the workspace does not configure, instead of failing', async () => {
    expect((await runCheck(workspace.config, 'unconfigured')).issues).toEqual([
      { slug: 'unconfigured', reason: 'asks for the light theme, which the workspace does not configure' },
    ])
  })

  it('holds each variant to the budget the configuration states today', async () => {
    expect((await runCheck(workspace.config, 'over-budget')).issues).toEqual([
      { slug: 'over-budget', reason: 'hero.gif is 8KB, over the 4KB budget' },
    ])
  })

  it('notices an animation whose size no longer matches its record', async () => {
    expect((await runCheck(workspace.config, 'drifted')).issues).toEqual([
      { slug: 'drifted', reason: 'hero.dark.gif is 2KB but its audit record says 4KB' },
    ])
  })

  it('names the variant whose file is missing', async () => {
    expect((await runCheck(workspace.config, 'gone')).issues).toEqual([
      { slug: 'gone', reason: 'hero.dark.gif is missing. Run: nx media tool-media --scene=gone' },
    ])
  })

  it('reports a variant recorded without the animation the scene emits', async () => {
    expect((await runCheck(workspace.config, 'no-animation')).issues).toEqual([
      {
        slug: 'no-animation',
        reason: 'the portable variant was recorded without its animation. Run: nx media tool-media --scene=no-animation',
      },
    ])
  })

  it("verifies each variant's stills against their own budgets and records", async () => {
    expect((await runCheck(workspace.config, 'stills')).issues).toEqual([
      { slug: 'stills', reason: 'poster.webp is 5KB, over the 4KB budget' },
      { slug: 'stills', reason: 'lost.webp is missing. Run: nx media tool-media --scene=stills' },
      { slug: 'stills', reason: 'poster.dark.webp is 50 bytes but its audit record says 60' },
    ])
  })

  it('verifies a browser scene by its single animation and its stills', async () => {
    expect(await runCheck(workspace.config, 'browser-good')).toEqual({ checked: 1, issues: [] })
  })

  it('looks for no animation from a browser scene that emits only stills', async () => {
    expect((await runCheck(workspace.config, 'browser-still')).issues).toEqual([
      { slug: 'browser-still', reason: 'poster.webp is 0KB, over the 0KB budget' },
    ])
  })

  it('reports a scene that opts out of every theme, instead of failing', async () => {
    expect((await runCheck(workspace.config, 'themeless')).issues).toEqual([
      { slug: 'themeless', reason: 'names no themes, so there is nothing to record it as' },
    ])
  })

  it('asks for every variant when a scripted scene was recorded before variants existed', async () => {
    expect((await runCheck(workspace.config, 'pre-variant')).issues).toEqual([
      { slug: 'pre-variant', reason: 'no portable variant was recorded. Run: nx media tool-media --scene=pre-variant' },
      { slug: 'pre-variant', reason: 'no dark variant was recorded. Run: nx media tool-media --scene=pre-variant' },
    ])
  })

  it('treats a browser record with no size as claiming nothing', async () => {
    expect((await runCheck(workspace.config, 'browser-unsized')).issues).toEqual([
      { slug: 'browser-unsized', reason: 'hero.gif is 2KB but its audit record says 0KB' },
    ])
  })

  it('names a browser scene whose animation is missing', async () => {
    expect((await runCheck(workspace.config, 'browser-gone')).issues).toEqual([
      { slug: 'browser-gone', reason: 'hero.gif is missing. Run: nx media tool-media --scene=browser-gone' },
    ])
  })
})
