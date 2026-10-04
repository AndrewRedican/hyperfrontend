import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Literal text inside a string built by a template or by concatenation.
 */
export interface TextPiece {
  /** Discriminant. */
  kind: 'text'
  /** The cooked text. */
  value: string
}

/**
 * An interpolated value inside a string built by a template or by concatenation.
 */
export interface ExpressionPiece {
  /** Discriminant. */
  kind: 'expression'
  /** The interpolated expression. */
  node: TSESTree.Node
}

/**
 * One piece of a built string, in source order.
 */
export type Piece = TextPiece | ExpressionPiece

/**
 * Appends a piece, merging adjacent text so separators are seen whole.
 *
 * @param pieces - The pieces so far.
 * @param piece - The piece to add.
 */
function pushPiece(pieces: Piece[], piece: Piece): void {
  const previous = pieces[pieces.length - 1]
  if (piece.kind === 'text' && previous?.kind === 'text') pieces[pieces.length - 1] = { kind: 'text', value: previous.value + piece.value }
  else if (piece.kind === 'expression' || piece.value.length > 0) pieces.push(piece)
}

/**
 * Collects the pieces of a node into a list.
 *
 * @param node - A template literal, a `+` chain, or any operand inside one.
 * @param pieces - The list to append to.
 */
function collect(node: TSESTree.Node, pieces: Piece[]): void {
  if (node.type === AST_NODE_TYPES.BinaryExpression && node.operator === '+') {
    collect(node.left, pieces)
    collect(node.right, pieces)
  } else if (node.type === AST_NODE_TYPES.TemplateLiteral) {
    node.quasis.forEach((quasi, index) => {
      pushPiece(pieces, { kind: 'text', value: quasi.value.cooked })
      const expression = node.expressions[index]
      if (expression) pushPiece(pieces, { kind: 'expression', node: expression })
    })
  } else if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    pushPiece(pieces, { kind: 'text', value: node.value })
  } else {
    pushPiece(pieces, { kind: 'expression', node })
  }
}

/**
 * Splits a template literal or `+` chain into text and interpolated pieces.
 *
 * @param node - The template literal or `+` chain.
 * @returns The pieces, in source order, with adjacent text merged.
 */
export function piecesOf(node: TSESTree.Node): Piece[] {
  const pieces: Piece[] = []
  collect(node, pieces)
  return pieces
}

/**
 * Escapes text for a single-quoted string literal.
 *
 * @param text - Raw text.
 * @returns The quoted literal.
 */
function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * Escapes text for the inside of a template literal.
 *
 * @param text - Raw text.
 * @returns The escaped text.
 */
function escapeTemplate(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/**
 * Renders an expression for use inside `${...}` or as a call argument.
 *
 * @param node - Any expression node to print.
 * @param sourceCode - Source code of the file being linted.
 * @returns The expression source, parenthesised when it is a sequence.
 */
export function expressionSource(node: TSESTree.Node, sourceCode: Readonly<TSESLint.SourceCode>): string {
  const text = sourceCode.getText(node)
  return node.type === AST_NODE_TYPES.SequenceExpression ? `(${text})` : text
}

/**
 * Renders pieces as a template literal, replacing every `/` in their text with an
 * interpolated separator.
 *
 * @param pieces - The pieces to render.
 * @param separator - Source text of the separator to interpolate.
 * @param sourceCode - Source code of the file being linted.
 * @returns The template literal source.
 */
export function renderWithSeparator(pieces: readonly Piece[], separator: string, sourceCode: Readonly<TSESLint.SourceCode>): string {
  const body = pieces
    .map((piece) =>
      piece.kind === 'text'
        ? escapeTemplate(piece.value).split('/').join(`\${${separator}}`)
        : `\${${expressionSource(piece.node, sourceCode)}}`
    )
    .join('')
  return `\`${body}\``
}

/**
 * Renders one path segment as a call argument.
 *
 * @param segment - The pieces between two separators.
 * @param sourceCode - Source code of the file being linted.
 * @returns A string literal, the bare expression, or a template literal.
 */
function renderSegment(segment: readonly Piece[], sourceCode: Readonly<TSESLint.SourceCode>): string {
  const [first] = segment
  if (segment.length === 1 && first.kind === 'expression') return expressionSource(first.node, sourceCode)
  if (segment.length === 1 && first.kind === 'text') return quote(first.value)
  return renderWithSeparator(segment, '', sourceCode)
}

/**
 * Turns a `/`-joined string into the arguments of an equivalent `join(...)` call, so
 * `` `${root}/src/${name}.ts` `` becomes `root, 'src', `${name}.ts``.
 *
 * @param pieces - The pieces of the built string.
 * @param sourceCode - Source code of the file being linted.
 * @returns The argument sources, or null when a separator is leading, trailing, or doubled.
 */
export function joinArguments(pieces: readonly Piece[], sourceCode: Readonly<TSESLint.SourceCode>): string[] | null {
  const segments: Piece[][] = [[]]
  for (const piece of pieces) {
    const parts = piece.kind === 'text' ? piece.value.split('/') : [piece]
    parts.forEach((part, index) => {
      if (index > 0) segments.push([])
      if (typeof part !== 'string') segments[segments.length - 1].push(part)
      else if (part.length > 0) segments[segments.length - 1].push({ kind: 'text', value: part })
    })
  }
  if (segments.length < 2 || segments.some((segment) => segment.length === 0)) return null
  return segments.map((segment) => renderSegment(segment, sourceCode))
}
