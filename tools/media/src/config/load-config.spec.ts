import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after as afterAll } from 'node:test'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from '@hyperfrontend/testing'
import { loadConfig, validateVariants } from './load-config'

const roots: string[] = []

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true })
  }
})

/**
 * Write a configuration file and return its path.
 *
 * @param body - The object literal handed to `defineConfig`, as source.
 * @returns Absolute path of the file.
 */
function configFile(body: string): string {
  const root = mkdtempSync(join(tmpdir(), 'media-config-'))
  roots.push(root)
  const filePath = join(root, 'media.config.ts')
  const defineConfig = resolve(fileURLToPath(import.meta.url), '../define-config.ts')
  writeFileSync(filePath, `import { defineConfig } from '${defineConfig}'\nexport default defineConfig(${body})\n`)
  return filePath
}

describe('loadConfig', () => {
  it('rejects a path with no file', async () => {
    await expect(loadConfig('/nowhere/media.config.ts')).rejects.toThrow('No media configuration at /nowhere/media.config.ts')
  })

  it('rejects a file that exports no root directory', async () => {
    const filePath = configFile('{}')
    await expect(loadConfig(filePath)).rejects.toThrow(`${filePath} must default-export defineConfig({ rootDir: '...' })`)
  })

  it('renders the portable, dark and light variants when a workspace names none', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.' }"))
    expect(loaded.variants).toEqual([
      expect.objectContaining({ theme: 'portable', suffix: '', gif: { maxBytes: 1_200_000 } }),
      expect.objectContaining({ theme: 'dark', suffix: '.dark' }),
      expect.objectContaining({ theme: 'light', suffix: '.light' }),
    ])
  })

  it('takes the variants a workspace names, in its order', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.', variants: [{ theme: 'light', suffix: '', intent: 'a light page' }] }"))
    expect(loaded.variants).toEqual([{ theme: 'light', suffix: '', intent: 'a light page' }])
  })

  it('writes a still as the browser produced it unless a scene asks for a quality', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.' }"))
    expect(loaded.defaults.still).toEqual({ format: 'png', quality: 100, width: 0 })
  })

  it('gives the public URL a trailing slash', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.', publicBaseUrl: 'https://example.test/media' }"))
    expect(loaded.publicBaseUrl).toBe('https://example.test/media/')
  })

  it('leaves an empty public URL empty', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.' }"))
    expect(loaded.publicBaseUrl).toBe('')
  })

  it('fills every encoder and browser default', async () => {
    const loaded = await loadConfig(configFile("{ rootDir: '.' }"))
    expect(loaded).toEqual(
      expect.objectContaining({
        encoder: { prefer: 'auto', binaries: { ffmpeg: 'ffmpeg', gifsicle: 'gifsicle' } },
        browser: { executablePath: '', args: [], readyTimeoutMs: 60_000 },
        defaults: expect.objectContaining({
          gif: { width: 640, fps: 10, colours: 128, lossy: 60, dither: true, loop: 0, maxBytes: 2_000_000 },
        }),
      })
    )
  })

  it('keeps every value a workspace states', async () => {
    const loaded = await loadConfig(
      configFile(
        "{ rootDir: '.', publicBaseUrl: 'https://x.test/', encoder: { prefer: 'sharp', binaries: { ffmpeg: '/f', gifsicle: '/g' } }, browser: { executablePath: '/c', args: ['--a'], readyTimeoutMs: 5 }, defaults: { gif: { width: 1, fps: 2, colours: 3, lossy: 4, dither: false, loop: 5, maxBytes: 6 }, still: { format: 'webp', quality: 7, width: 8 } } }"
      )
    )
    expect(loaded).toEqual(
      expect.objectContaining({
        publicBaseUrl: 'https://x.test/',
        encoder: { prefer: 'sharp', binaries: { ffmpeg: '/f', gifsicle: '/g' } },
        browser: { executablePath: '/c', args: ['--a'], readyTimeoutMs: 5 },
        defaults: {
          gif: { width: 1, fps: 2, colours: 3, lossy: 4, dither: false, loop: 5, maxBytes: 6 },
          still: { format: 'webp', quality: 7, width: 8 },
        },
      })
    )
  })

  it('rejects a configuration whose variants collide', async () => {
    const filePath = configFile(
      "{ rootDir: '.', variants: [{ theme: 'dark', suffix: '', intent: 'x' }, { theme: 'dark', suffix: '.d', intent: 'y' }] }"
    )
    await expect(loadConfig(filePath)).rejects.toThrow('The dark theme is configured as two variants')
  })
})

describe('validateVariants', () => {
  it('returns the variants it was given', () => {
    const variants = [{ theme: 'dark' as const, suffix: '', intent: 'x' }]
    expect(validateVariants(variants)).toBe(variants)
  })

  it('rejects an empty list', () => {
    expect(() => validateVariants([])).toThrow('A media configuration needs at least one variant')
  })

  it('rejects a theme no built-in table carries', () => {
    expect(() => validateVariants([{ theme: 'sepia' as never, suffix: '', intent: 'x' }])).toThrow('No media theme named "sepia"')
  })

  it('rejects two variants writing under one suffix', () => {
    expect(() =>
      validateVariants([
        { theme: 'dark', suffix: '.x', intent: 'a' },
        { theme: 'light', suffix: '.x', intent: 'b' },
      ])
    ).toThrow('Two variants write under the same suffix ".x", so one would overwrite the other')
  })
})
