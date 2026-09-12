import type { MediaConfigInput, ResolvedMediaConfig, VariantSpec } from '../models/config'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { builtInTheme } from '../theme/themes'
import { resolveRoots } from './resolve-roots'

/**
 * The variants a workspace gets when it names none.
 *
 * Portable first and under the bare name, because that is the file a readme
 * points at and the one that has to work wherever the readme is rendered. The
 * budget is held below the documentation variants' on purpose: a package
 * listing loads a readme's images before anything else on the page, and a
 * megabyte there is a different cost from a megabyte on a page that asked for
 * it.
 */
const DEFAULT_VARIANTS: readonly VariantSpec[] = [
  { theme: 'portable', suffix: '', intent: 'npm and GitHub readmes, and any page whose theme is not known', gif: { maxBytes: 1_200_000 } },
  { theme: 'dark', suffix: '.dark', intent: 'the documentation site in its dark theme' },
  { theme: 'light', suffix: '.light', intent: 'the documentation site in its light theme' },
]

/** Shape a configuration module arrives in once the runtime has transpiled it. */
interface ConfigModule {
  /** The configuration the file default-exported. */
  default?: MediaConfigInput
}

/**
 * Confirm the variants a workspace configures can all be produced side by side.
 *
 * Two variants with one suffix would write over each other's files, two with
 * one theme would be the same file twice, and a theme with no built-in table
 * has nothing to draw with. Each is a configuration mistake, so each is
 * reported when the configuration is read rather than when the first scene
 * fails.
 *
 * @param variants - The variants as configured, or as defaulted.
 * @returns The same variants.
 * @throws {Error} When a variant repeats another's theme or suffix, names an unknown theme, or the list is empty.
 */
export function validateVariants(variants: readonly VariantSpec[]): readonly VariantSpec[] {
  if (variants.length === 0) {
    throw createError('A media configuration needs at least one variant')
  }
  variants.forEach((variant, index) => {
    builtInTheme(variant.theme)
    const earlier = variants.slice(0, index)
    if (earlier.some((other) => other.theme === variant.theme)) {
      throw createError(`The ${variant.theme} theme is configured as two variants`)
    }
    if (earlier.some((other) => other.suffix === variant.suffix)) {
      throw createError(`Two variants write under the same suffix "${variant.suffix}", so one would overwrite the other`)
    }
  })
  return variants
}

/**
 * Load a workspace configuration file and fill in everything it left unsaid.
 *
 * Defaults are deliberately conservative: a 640 pixel, 10 frame per second,
 * 128 colour GIF under two megabytes is a reasonable asset for almost any
 * scene, and a scene that needs otherwise says so in one line.
 *
 * @param configPath - Absolute path of the configuration file.
 * @returns The configuration with defaults applied and every path absolute.
 * @throws {Error} When the file is missing or exports no configuration.
 */
export async function loadConfig(configPath: string): Promise<ResolvedMediaConfig> {
  if (!existsSync(configPath)) {
    throw createError(`No media configuration at ${configPath}`)
  }
  const loaded = (await import(pathToFileURL(configPath).href)) as ConfigModule
  const config = loaded.default
  if (config === undefined || typeof config.rootDir !== 'string' || config.rootDir === '') {
    throw createError(`${configPath} must default-export defineConfig({ rootDir: '...' })`)
  }
  const publicBaseUrl = config.publicBaseUrl ?? ''
  return {
    roots: resolveRoots(configPath, config),
    publicBaseUrl: publicBaseUrl !== '' && !publicBaseUrl.endsWith('/') ? `${publicBaseUrl}/` : publicBaseUrl,
    encoder: {
      prefer: config.encoder?.prefer ?? 'auto',
      binaries: {
        ffmpeg: config.encoder?.binaries?.ffmpeg ?? 'ffmpeg',
        gifsicle: config.encoder?.binaries?.gifsicle ?? 'gifsicle',
      },
    },
    browser: {
      executablePath: config.browser?.executablePath ?? '',
      args: config.browser?.args ?? [],
      readyTimeoutMs: config.browser?.readyTimeoutMs ?? 60_000,
    },
    defaults: {
      gif: {
        width: config.defaults?.gif?.width ?? 640,
        fps: config.defaults?.gif?.fps ?? 10,
        colours: config.defaults?.gif?.colours ?? 128,
        lossy: config.defaults?.gif?.lossy ?? 60,
        dither: config.defaults?.gif?.dither ?? true,
        loop: config.defaults?.gif?.loop ?? 0,
        maxBytes: config.defaults?.gif?.maxBytes ?? 2_000_000,
      },
      still: {
        format: config.defaults?.still?.format ?? 'png',
        // why: a PNG at full quality is the browser's own bytes; a scene that wants an indexed one says so
        quality: config.defaults?.still?.quality ?? 100,
        width: config.defaults?.still?.width ?? 0,
      },
    },
    variants: validateVariants(config.variants ?? DEFAULT_VARIANTS),
  }
}
