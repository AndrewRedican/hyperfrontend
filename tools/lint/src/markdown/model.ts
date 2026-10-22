/**
 * The Markdown tree: the node kinds mdast names, each with its position in the source and the
 * fields the rules read. One node shape serves every kind; a field a kind does not carry is
 * undefined.
 *
 * @module markdown/model
 */

/** A point in the source. */
export interface MarkdownPoint {
  /** The 1-based line. */
  readonly line: number
  /** The 1-based column. */
  readonly column: number
  /** The 0-based offset. */
  readonly offset: number
}

/** Where a node sits. */
export interface MarkdownPosition {
  /** The first character. */
  readonly start: MarkdownPoint
  /** After the last character. */
  readonly end: MarkdownPoint
}

/** The node kinds, named as mdast names them. */
export type MarkdownKind =
  | 'root'
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'inlineCode'
  | 'code'
  | 'html'
  | 'thematicBreak'
  | 'blockquote'
  | 'list'
  | 'listItem'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'link'
  | 'linkReference'
  | 'image'
  | 'imageReference'
  | 'definition'
  | 'footnoteDefinition'
  | 'footnoteReference'
  | 'emphasis'
  | 'strong'
  | 'delete'
  | 'break'

/** How a table column is aligned. */
export type MarkdownAlign = 'left' | 'right' | 'center' | null

/** A node of the tree. */
export interface MarkdownNode {
  /** The kind, which selects listeners. */
  readonly kind: MarkdownKind
  /** Where the node sits. */
  readonly position: MarkdownPosition
  /** The children, in source order; absent on leaves. */
  readonly children?: readonly MarkdownNode[]
  /** The text of a text, inline code, code or HTML node. */
  readonly value?: string
  /** The level of a heading, 1 to 6. */
  readonly depth?: number
  /** The language a fenced code block declares; absent when the fence names none. */
  readonly lang?: string
  /** The rest of a fence's info string after the language. */
  readonly meta?: string
  /** The target of a link, image or definition. */
  readonly url?: string
  /** The title of a link, image or definition. */
  readonly title?: string
  /** The alternative text of an image. */
  readonly alt?: string
  /** Whether a list is numbered. */
  readonly ordered?: boolean
  /** The first number of an ordered list. */
  readonly start?: number
  /** The state of a task list item's checkbox. */
  readonly checked?: boolean
  /** The normalised label of a reference, definition or footnote. */
  readonly identifier?: string
  /** The alignment of each table column. */
  readonly align?: readonly MarkdownAlign[]
}
