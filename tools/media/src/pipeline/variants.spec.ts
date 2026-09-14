import type { ResolvedMediaConfig } from '../models/config'
import type { ScriptedScene } from '../models/scene'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DARK_VARIANT, PORTABLE_VARIANT, resolvedConfigFor } from '../scene/__test-utils__/scene-dir'
import { resolveProfile } from '../stage/profiles'
import { suffixStills, unconfiguredThemes, variantGifOptions, variantsFor } from './variants'

const config: ResolvedMediaConfig = resolvedConfigFor('/media-workspace')

/**
 * A scripted scene with the fields variant selection reads.
 *
 * @param fields - What this scene states beyond the minimum.
 * @returns A scene named `demo`, drawn by nothing.
 */
function scene(fields: Partial<ScriptedScene> = {}): ScriptedScene {
  return {
    kind: 'scripted',
    slug: 'demo',
    outputs: ['gif'],
    profile: 'compact',
    stageId: 'dot',
    styles: () => '',
    durationMs: () => 1_000,
    frame: () => '',
    ...fields,
  }
}

describe('unconfiguredThemes', () => {
  it('finds nothing wanting when the scene names no themes', () => {
    expect(unconfiguredThemes(scene(), config)).toEqual([])
  })

  it('finds nothing wanting when every named theme is configured', () => {
    expect(unconfiguredThemes(scene({ themes: ['dark', 'portable'] }), config)).toEqual([])
  })

  it('names each theme the workspace does not configure, in the scene order', () => {
    expect(unconfiguredThemes(scene({ themes: ['light', 'dark', 'sepia' as never] }), config)).toEqual(['light', 'sepia'])
  })
})

describe('variantsFor', () => {
  it('renders every configured variant when the scene names none', () => {
    expect(variantsFor(scene(), config)).toEqual(config.variants)
  })

  it('keeps the configured order when the scene lists a subset in another', () => {
    expect(variantsFor(scene({ themes: ['dark', 'portable'] }), config).map((variant) => variant.theme)).toEqual(['portable', 'dark'])
  })

  it('renders only the variants the scene names', () => {
    expect(variantsFor(scene({ themes: ['dark'] }), config)).toEqual([expect.objectContaining({ theme: 'dark', suffix: '.dark' })])
  })

  it('rejects a theme the workspace does not configure', () => {
    expect(() => variantsFor(scene({ themes: ['light'] }), config)).toThrow(
      'demo asks for the light theme but the workspace configures only portable, dark'
    )
  })

  it('names every missing theme at once', () => {
    expect(() => variantsFor(scene({ themes: ['light', 'sepia' as never] }), config)).toThrow('demo asks for the light, sepia themes')
  })

  it('rejects a scene that names no themes at all', () => {
    expect(() => variantsFor(scene({ themes: [] }), config)).toThrow('demo names no themes, so there is nothing to render it as')
  })
})

describe('variantGifOptions', () => {
  const profile = resolveProfile('compact')

  it("takes the profile's width and rate over the workspace defaults", () => {
    expect(variantGifOptions(config.defaults, scene(), DARK_VARIANT, profile)).toEqual({
      ...config.defaults.gif,
      width: profile.width,
      fps: profile.fps,
    })
  })

  it("lays the variant's budget over the scene's", () => {
    expect(variantGifOptions(config.defaults, scene({ gif: { maxBytes: 500_000, colours: 32 } }), PORTABLE_VARIANT, profile)).toEqual(
      expect.objectContaining({ maxBytes: 4_096, colours: 32 })
    )
  })

  it("keeps the scene's own width and rate when it states them", () => {
    expect(variantGifOptions(config.defaults, scene({ gif: { width: 320 }, fps: 4 }), DARK_VARIANT, profile)).toEqual(
      expect.objectContaining({ width: 320, fps: 4 })
    )
  })
})

describe('suffixStills', () => {
  it('names every still for its variant and changes nothing else', () => {
    expect(suffixStills([{ name: 'poster', atMs: 100, format: 'webp' }], '.dark')).toEqual([
      { name: 'poster.dark', atMs: 100, format: 'webp' },
    ])
  })

  it('leaves names alone for the variant under the bare name', () => {
    expect(suffixStills([{ name: 'poster', atMs: 100 }], '')).toEqual([{ name: 'poster', atMs: 100 }])
  })
})
