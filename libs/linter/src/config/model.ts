/**
 * The configuration as data: ordered blocks that name the files they apply to and the rules
 * they set, a later block winning over an earlier one. A project's configuration file lists the
 * workspace's base blocks followed by its own. No block names a parser or a language: the
 * linter reads each file by its extension. The packaged rules need no registration; a block's
 * `families` adds rules of its own under a prefix.
 *
 * @module config/model
 */

import type { RuleFamily } from '../engine/registry'

/** How a rule is set: off, or a severity with optional options. */
export type RuleSetting = 'off' | 'warn' | 'error' | readonly ['warn' | 'error', unknown]

/** One configuration block. */
export interface ConfigBlock {
  /** Globs, relative to the configuration file's directory, of the files the block applies to; absent means every file the other blocks select. */
  readonly files?: readonly string[]
  /** Globs of files the block does not apply to; in a block without `files`, globs no block applies to. */
  readonly ignores?: readonly string[]
  /** Rules by id. */
  readonly rules?: Readonly<Record<string, RuleSetting>>
  /** Settings every rule of the block's files may read. */
  readonly settings?: Readonly<Record<string, unknown>>
  /** How the code files the block selects are read; what is left out keeps the earlier blocks' value. */
  readonly language?: Partial<LanguageSettings>
  /** Rules beyond the packaged ones, by family prefix; a family is registered for the whole configuration, whatever the block's `files`. */
  readonly families?: Readonly<Record<string, RuleFamily>>
}

/** How a code file's text is read: its module kind, the names it sees as globals and the JSX pragma. */
export interface LanguageSettings {
  /** `module` for an ES module, `script` for a classic script, `commonjs` for a CommonJS module. */
  readonly sourceType: 'module' | 'script' | 'commonjs'
  /** The global names beyond the language's own, each writable or read-only. */
  readonly globals: Readonly<Record<string, 'readonly' | 'writable'>>
  /** The identifier every JSX element references, or null when JSX references none. */
  readonly jsxPragma: string | null
  /** The identifier a JSX fragment references in place of the pragma, or null for the pragma. */
  readonly jsxFragmentName: string | null
}

/** How a code file is read unless a block says otherwise: an ES module seeing no extra globals, with React as the JSX pragma. */
export const DEFAULT_LANGUAGE: LanguageSettings = { sourceType: 'module', globals: {}, jsxPragma: 'React', jsxFragmentName: null }

/** The rules in effect for one file. */
export interface EffectiveConfig {
  /** Rules that are on, by id, with their severity and options. */
  readonly rules: ReadonlyMap<string, EffectiveRule>
  /** The merged settings of the blocks that matched. */
  readonly settings: Readonly<Record<string, unknown>>
  /** How the file's text is read. */
  readonly language: LanguageSettings
}

/** One rule in effect. */
export interface EffectiveRule {
  /** 1 for a warning, 2 for an error. */
  readonly severity: 1 | 2
  /** The options, or undefined when none were given. */
  readonly options: unknown
}
