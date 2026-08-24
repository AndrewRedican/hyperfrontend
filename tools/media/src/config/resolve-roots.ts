import type { MediaConfigInput, ResolvedRoots } from '../models/config'
import { dirname, isAbsolute, resolve } from 'node:path'

/**
 * Resolve one configured path against a base directory.
 *
 * An absolute value is taken as written so a workspace can point at something
 * outside its own tree without the recorder second-guessing it.
 *
 * @param baseDir - Absolute directory relative values are resolved against.
 * @param value - The configured path.
 * @returns An absolute path.
 */
function resolveAgainst(baseDir: string, value: string): string {
  return isAbsolute(value) ? value : resolve(baseDir, value)
}

/**
 * Turn a configuration file's relative paths into absolute directories.
 *
 * `rootDir` is resolved against the configuration file itself, and everything
 * else against `rootDir`. That single rule is what lets a scene name a path
 * like `dist/site` without knowing where the configuration file lives.
 *
 * @param configPath - Absolute path of the configuration file.
 * @param config - The workspace configuration as authored.
 * @returns Every directory the run needs, absolute.
 */
export function resolveRoots(configPath: string, config: MediaConfigInput): ResolvedRoots {
  const configDir = dirname(configPath)
  const rootDir = resolveAgainst(configDir, config.rootDir)
  return {
    configDir,
    rootDir,
    sceneDir: resolveAgainst(rootDir, config.sceneDir ?? 'scenes'),
    outputDir: resolveAgainst(rootDir, config.outputDir ?? 'media'),
    tmpDir: resolveAgainst(rootDir, config.tmpDir ?? 'tmp'),
  }
}
