import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { BindingContext } from './bindings'

/**
 * Message identifiers reported by lib-cross-platform, including its suggestion messages.
 */
export type MessageIds =
  | 'separatorLiteral'
  | 'absoluteCheck'
  | 'separatorJoin'
  | 'relativeEscapes'
  | 'driveLetterLoss'
  | 'posixConversion'
  | 'nativeImport'
  | 'urlPathname'
  | 'shellShim'
  | 'lineSplit'
  | 'hardcodedTmp'
  | 'treatAsNative'
  | 'treatAsPortable'
  | 'useShellOnWindows'
  | 'useOsPath'

/**
 * A module whose exported path helpers have a known output domain.
 */
export interface PathHelperModule {
  /**
   * Bare specifier, or workspace-relative source path, the helpers are imported from.
   * Deeper paths match too: `@scope/pkg/core` covers `@scope/pkg/core/path`.
   */
  module: string
  /** Exports that return native OS paths (backslashes on Windows). */
  native?: string[]
  /** Exports that return portable forward-slash paths on every platform. */
  portable?: string[]
}

/**
 * Options accepted by lib-cross-platform.
 */
export interface RuleOptions {
  /** Path helpers outside `node:path` whose output domain the rule should trust. */
  helpers?: PathHelperModule[]
  /** Commands that are `.cmd` shims on Windows and cannot be spawned without a shell. */
  shimCommands?: string[]
}

/**
 * The separator convention a string value follows.
 *
 * `native` uses the OS separator, `relative` is a native relative path from `relative()`,
 * `portable` always uses `/`, and `unknown` could be any of them.
 */
export type DomainKind = 'native' | 'relative' | 'portable' | 'unknown'

/**
 * What the rule knows about the separators in a string value.
 */
export interface Domain {
  /** Which separator convention the value follows. */
  kind: DomainKind
  /** Whether an unknown value is named like a filesystem path. */
  pathLike: boolean
}

/**
 * How confident the rule is that a value is a native path: 1 when its origin proves it,
 * 2 when only its name suggests it, 0 when it is not treated as one.
 */
export type Tier = 0 | 1 | 2

/**
 * Which separator flavour an edit should produce.
 */
export type Flavour = 'native' | 'portable'

/**
 * The rule context lib-cross-platform runs with.
 */
export type RuleContext = Readonly<TSESLint.RuleContext<MessageIds, [RuleOptions?]>>

/**
 * Everything the individual checks need to know about the file being linted.
 */
export interface CheckContext {
  /** The ESLint rule context. */
  context: RuleContext
  /** Source code of the file being linted. */
  sourceCode: Readonly<TSESLint.SourceCode>
  /** What binding resolution needs to know about the file. */
  binding: BindingContext
  /** Helper modules with known output domains. */
  helpers: readonly PathHelperModule[]
  /** Whether the owning project imports any `node:` module from its sources. */
  nodeCapable: boolean
  /** Whether this file imports any `node:` module. */
  nodeFile: boolean
  /** Commands that need a shell on Windows. */
  shimCommands: ReadonlySet<string>
  /** Classifies the separator domain of an expression. */
  classify: (node: TSESTree.Node) => Domain
  /** Returns how confidently an expression is treated as a native path. */
  tierOf: (node: TSESTree.Node) => Tier
}
