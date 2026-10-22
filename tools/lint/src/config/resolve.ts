/**
 * Which files a configuration selects and which rules apply to each: the blocks in order, a
 * later block's rule setting winning over an earlier one, as flat configurations work. Paths are
 * relative to the configuration file's directory.
 *
 * @module config/resolve
 */

import type { Glob } from '../files/glob.ts'
import type { ConfigBlock, EffectiveConfig, EffectiveRule, LanguageSettings, RuleSetting } from './model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { compileGlob, matchesAny } from '../files/glob.ts'
import { DEFAULT_LANGUAGE } from './model.ts'

/** A block with its globs compiled. */
interface CompiledBlock {
  /** The block as configured. */
  readonly block: ConfigBlock
  /** The compiled `files`, or null when the block has none. */
  readonly files: readonly Glob[] | null
  /** The compiled `ignores`. */
  readonly ignores: readonly Glob[]
}

/** A configuration, ready to answer for files. */
export interface ProjectConfig {
  /** The blocks in order. */
  readonly blocks: readonly CompiledBlock[]
  /** The globs no block applies to: the `ignores` of blocks without `files`. */
  readonly globalIgnores: readonly Glob[]
}

/**
 * Prepares a configuration: its globs compiled and its global ignores collected.
 *
 * @param config - The blocks of a configuration file, in order
 * @returns The configuration
 */
export function projectConfig(config: readonly ConfigBlock[]): ProjectConfig {
  const blocks = config.map((block) => ({
    block,
    files: block.files === undefined ? null : block.files.map(compileGlob),
    ignores: (block.ignores ?? []).map(compileGlob),
  }))
  return { blocks, globalIgnores: blocks.filter((block) => block.files === null).flatMap((block) => block.ignores) }
}

/**
 * Whether a global ignore matches a file.
 *
 * @param config - The configuration
 * @param path - The file, relative to the configuration's directory, POSIX
 * @returns True when the file is ignored
 */
export function isIgnored(config: ProjectConfig, path: string): boolean {
  return matchesAny(config.globalIgnores, path)
}

/**
 * Whether the configuration lints a file: some block's `files` matches it and no global ignore does.
 *
 * @param config - The configuration
 * @param path - The file, relative to the configuration's directory, POSIX
 * @returns True when the file is linted
 */
export function selectsFile(config: ProjectConfig, path: string): boolean {
  if (isIgnored(config, path)) return false
  return config.blocks.some((block) => block.files !== null && matchesAny(block.files, path) && !matchesAny(block.ignores, path))
}

/**
 * The rules and settings in effect for a file: every applicable block in order, later settings
 * winning.
 *
 * @param config - The configuration
 * @param path - The file, relative to the configuration's directory, POSIX
 * @returns The effective configuration
 */
export function effectiveConfig(config: ProjectConfig, path: string): EffectiveConfig {
  const rules = createMap<string, EffectiveRule>()
  let settings: Record<string, unknown> = {}
  let language: LanguageSettings = DEFAULT_LANGUAGE
  for (const { block, files, ignores } of config.blocks) {
    if (files !== null && !matchesAny(files, path)) continue
    if (matchesAny(ignores, path)) continue
    for (const [id, setting] of entries(block.rules ?? {})) {
      const effective = toEffective(setting)
      if (effective === null) rules.delete(id)
      else rules.set(id, effective)
    }
    if (block.settings !== undefined) settings = { ...settings, ...block.settings }
    if (block.language !== undefined)
      language = { ...language, ...block.language, globals: { ...language.globals, ...block.language.globals } }
  }
  return { rules, settings, language }
}

/**
 * A rule setting as the engine reads it.
 *
 * @param setting - The setting as configured
 * @returns The severity and options, or null when the rule is off
 */
function toEffective(setting: RuleSetting): EffectiveRule | null {
  if (setting === 'off') return null
  if (setting === 'warn') return { severity: 1, options: undefined }
  if (setting === 'error') return { severity: 2, options: undefined }
  return { severity: setting[0] === 'warn' ? 1 : 2, options: setting[1] }
}
