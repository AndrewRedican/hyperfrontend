/**
 * The shapes the dependency checks of a hook callback share: the hook call, the paths the
 * callback uses and its array declares, and the state of one callback's check.
 *
 * @module rules/react-hooks/shared/check
 */

import type { Node } from '../../../code/model'
import type { RuleContext } from '../../../engine/rule'
import type { Reference, Scope } from '../../../scope/model'
import type { StableValues } from './stable-values'

/** A path the callback uses, and how. */
export interface Used {
  /** Whether the value is known not to change between renders. */
  readonly stable: boolean
  /** The references reading or writing it. */
  readonly references: Reference[]
}

/** A path the array declares. */
export interface Declared {
  /** The dotted path. */
  readonly key: string
  /** The array element declaring it. */
  readonly node: Node
}

/** A ref read as `.current` inside an effect's cleanup. */
export interface CleanupRead {
  /** The reference to the ref. */
  readonly reference: Reference
  /** The `current` property read. */
  readonly property: Node
}

/** What the checks of one callback share. */
export interface Check {
  /** The rule's context. */
  readonly context: RuleContext<undefined, Node>
  /** The stability verdicts shared by the file's hooks. */
  readonly stableValues: StableValues
  /** The hook call. */
  readonly hook: HookCall
  /** The callback function. */
  readonly callback: Node
  /** The callback's scope. */
  readonly scope: Scope
  /** The component's or hook's function scope. */
  readonly component: Scope
  /** The paths the callback uses, in the order first used. */
  readonly used: Map<string, Used>
  /** Whether each used path was only ever read optionally. */
  readonly optional: Map<string, boolean>
  /** The used paths known not to change between renders. */
  readonly stable: Set<string>
  /** Reports a problem on a node. */
  readonly report: (node: Node, message: string) => void
  /** The text of a node. */
  readonly source: (node: Node) => string
}

/** The hook call being checked. */
export interface HookCall {
  /** The callee, as written. */
  readonly callee: Node
  /** The hook's name without the `React.` namespace. */
  readonly name: string
  /** The dependency array argument, or null. */
  readonly deps: Node | null
  /** Whether the hook is an effect. */
  readonly isEffect: boolean
}
