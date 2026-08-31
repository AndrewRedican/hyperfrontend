import type { MediaConfigInput, ResolvedMediaConfig } from '../models/config'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { resolveRoots } from './resolve-roots'

/** Shape a configuration module arrives in once the runtime has transpiled it. */
interface ConfigModule {
  /** The configuration the file default-exported. */
  default?: MediaConfigInput
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
        quality: config.defaults?.still?.quality ?? 90,
        width: config.defaults?.still?.width ?? 0,
      },
    },
  }
}
