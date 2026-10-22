/**
 * The tree a regular expression pattern parses into: alternatives of elements, groups of every
 * kind, quantifiers, characters and the sets and classes of them, backreferences and assertions,
 * each with its offsets inside the pattern and its parent. The vocabulary follows the one
 * regular expression tooling shares, so that what is known of it carries over.
 *
 * @module regex/model
 */

/** What every node carries. */
interface RegexNodeBase {
  /** The offset of the node's first character in the pattern. */
  readonly start: number
  /** The offset after its last character. */
  end: number
  /** The node it sits in, null for the pattern. */
  parent: RegexNode | null
}

/** The whole pattern: a disjunction of alternatives. */
export interface PatternNode extends RegexNodeBase {
  /** Marks the pattern. */
  readonly kind: 'Pattern'
  /** The alternatives, one or more. */
  readonly alternatives: AlternativeNode[]
}

/** One alternative of a disjunction: a sequence of terms. */
export interface AlternativeNode extends RegexNodeBase {
  /** Marks the alternative. */
  readonly kind: 'Alternative'
  /** The terms, in order. */
  readonly elements: ElementNode[]
}

/** A non-capturing group, `(?:...)`, with its modifiers when it sets any. */
export interface GroupNode extends RegexNodeBase {
  /** Marks the group. */
  readonly kind: 'Group'
  /** The alternatives it holds. */
  readonly alternatives: AlternativeNode[]
  /** The modifier text between `(?` and `:`, such as `i-m`, or null when the group sets none. */
  readonly modifiers: string | null
}

/** A capturing group, numbered by its opening parenthesis and named when written `(?<name>...)`. */
export interface CapturingGroupNode extends RegexNodeBase {
  /** Marks the capturing group. */
  readonly kind: 'CapturingGroup'
  /** The name, or null for a numbered group. */
  readonly name: string | null
  /** The 1-based number a backreference uses. */
  readonly index: number
  /** The alternatives it holds. */
  readonly alternatives: AlternativeNode[]
}

/** A lookahead or lookbehind assertion. */
export interface LookaroundNode extends RegexNodeBase {
  /** Marks the lookaround. */
  readonly kind: 'Lookaround'
  /** Whether it looks behind rather than ahead. */
  readonly behind: boolean
  /** Whether it is negative. */
  readonly negate: boolean
  /** The alternatives it holds. */
  readonly alternatives: AlternativeNode[]
}

/** A quantified term. */
export interface QuantifierNode extends RegexNodeBase {
  /** Marks the quantifier. */
  readonly kind: 'Quantifier'
  /** The least repetitions. */
  readonly min: number
  /** The most repetitions, infinite for `*`, `+` and `{n,}`. */
  readonly max: number
  /** Whether the quantifier is greedy, false when a `?` follows it. */
  readonly greedy: boolean
  /** The term repeated. */
  readonly element: ElementNode
}

/** The assertions that match a position rather than a character. */
export type AssertionKind = 'start' | 'end' | 'word-boundary' | 'non-word-boundary'

/** An edge or word-boundary assertion: `^`, `$`, `\b` or `\B`. */
export interface AssertionNode extends RegexNodeBase {
  /** Marks the assertion. */
  readonly kind: 'Assertion'
  /** Which position it asserts. */
  readonly assertion: AssertionKind
}

/** One character, written as itself or as an escape. */
export interface CharacterNode extends RegexNodeBase {
  /** Marks the character. */
  readonly kind: 'Character'
  /** The code point it matches. */
  readonly value: number
  /** The text as written, from the backslash on for an escape. */
  readonly raw: string
}

/** The sets a character set node can stand for. */
export type CharacterSetKind = 'any' | 'digit' | 'space' | 'word' | 'property'

/** A set of characters named by `.`, a class escape such as `\d`, or a property escape. */
export interface CharacterSetNode extends RegexNodeBase {
  /** Marks the character set. */
  readonly kind: 'CharacterSet'
  /** Which set. */
  readonly set: CharacterSetKind
  /** Whether the escape was uppercase, naming the complement. */
  readonly negate: boolean
  /** A property escape's name, or the property when a value follows; null for the other sets. */
  readonly key: string | null
  /** A property escape's value after `=`, or null. */
  readonly value: string | null
  /** Whether a property escape names a property of strings, which only the `v` flag allows. */
  readonly strings: boolean
}

/** A character class listing characters, ranges, sets and, under the `v` flag, nested classes and strings. */
export interface CharacterClassNode extends RegexNodeBase {
  /** Marks the class. */
  readonly kind: 'CharacterClass'
  /** Whether a `^` negates it. */
  readonly negate: boolean
  /** What it lists, in order. */
  readonly elements: ClassElementNode[]
}

/** A character class whose contents are an intersection or a subtraction, under the `v` flag. */
export interface ExpressionCharacterClassNode extends RegexNodeBase {
  /** Marks the class. */
  readonly kind: 'ExpressionCharacterClass'
  /** Whether a `^` negates it. */
  readonly negate: boolean
  /** The operation it holds. */
  readonly expression: ClassOperationNode
}

/** The operations a `v` class can combine its operands with. */
export type ClassOperator = 'intersection' | 'subtraction'

/** An `&&` or `--` operation between two operands, nested to the left when chained. */
export interface ClassOperationNode extends RegexNodeBase {
  /** Marks the operation. */
  readonly kind: 'ClassOperation'
  /** Which operation. */
  readonly operator: ClassOperator
  /** The left operand, an operation itself when chained. */
  readonly left: ClassOperandNode | ClassOperationNode
  /** The right operand. */
  readonly right: ClassOperandNode
}

/** A range of characters inside a class. */
export interface CharacterClassRangeNode extends RegexNodeBase {
  /** Marks the range. */
  readonly kind: 'CharacterClassRange'
  /** The first character of the range. */
  readonly from: CharacterNode
  /** The last character of the range. */
  readonly to: CharacterNode
}

/** A `\q{...}` disjunction of strings inside a `v` class. */
export interface ClassStringDisjunctionNode extends RegexNodeBase {
  /** Marks the disjunction. */
  readonly kind: 'ClassStringDisjunction'
  /** The strings it lists, one or more. */
  readonly alternatives: StringAlternativeNode[]
}

/** One string of a `\q{...}` disjunction. */
export interface StringAlternativeNode extends RegexNodeBase {
  /** Marks the string. */
  readonly kind: 'StringAlternative'
  /** Its characters, none for the empty string. */
  readonly elements: CharacterNode[]
}

/** A backreference by number or by name. */
export interface BackreferenceNode extends RegexNodeBase {
  /** Marks the backreference. */
  readonly kind: 'Backreference'
  /** The group number, or the group name. */
  readonly ref: number | string
  /** The text as written. */
  readonly raw: string
  /** The groups it refers to: one by number, one or more by name. */
  resolved: CapturingGroupNode[]
}

/** The terms an alternative holds. */
export type ElementNode =
  | GroupNode
  | CapturingGroupNode
  | LookaroundNode
  | QuantifierNode
  | AssertionNode
  | CharacterNode
  | CharacterSetNode
  | CharacterClassNode
  | ExpressionCharacterClassNode
  | BackreferenceNode

/** What a character class lists. */
export type ClassElementNode =
  | CharacterNode
  | CharacterSetNode
  | CharacterClassRangeNode
  | CharacterClassNode
  | ExpressionCharacterClassNode
  | ClassStringDisjunctionNode

/** What a class operation combines. */
export type ClassOperandNode =
  | CharacterNode
  | CharacterSetNode
  | CharacterClassNode
  | ExpressionCharacterClassNode
  | ClassStringDisjunctionNode

/** Any node of the tree. */
export type RegexNode =
  | PatternNode
  | AlternativeNode
  | ElementNode
  | ClassOperationNode
  | CharacterClassRangeNode
  | ClassStringDisjunctionNode
  | StringAlternativeNode

/** Why a pattern was refused. */
export interface ParseError {
  /** What was wrong, in the words the engines use. */
  readonly message: string
  /** The offset in the pattern the fault was found at. */
  readonly index: number
}

/** What parsing a pattern produced. */
export interface ParseResult {
  /** The tree, or null when the pattern was refused. */
  readonly pattern: PatternNode | null
  /** Why the pattern was refused, or null when it parsed. */
  readonly error: ParseError | null
  /** Every character read, in order, up to the fault when the pattern was refused. */
  readonly characters: readonly CharacterNode[]
}

/**
 * The nodes directly under a node, in source order.
 *
 * @param node - The node whose children are listed
 * @returns The children, none for a leaf
 */
export function childrenOf(node: RegexNode): readonly RegexNode[] {
  switch (node.kind) {
    case 'Pattern':
    case 'Group':
    case 'CapturingGroup':
    case 'Lookaround':
    case 'ClassStringDisjunction':
      return node.alternatives
    case 'Alternative':
    case 'CharacterClass':
    case 'StringAlternative':
      return node.elements
    case 'Quantifier':
      return [node.element]
    case 'ExpressionCharacterClass':
      return [node.expression]
    case 'ClassOperation':
      return [node.left, node.right]
    case 'CharacterClassRange':
      return [node.from, node.to]
    default:
      return []
  }
}

/**
 * Calls a function on a node and on every node under it, parents before children, in source order.
 *
 * @param node - The node the walk starts from
 * @param enter - What is called on each node
 */
export function visit(node: RegexNode, enter: (node: RegexNode) => void): void {
  enter(node)
  for (const child of childrenOf(node)) visit(child, enter)
}
