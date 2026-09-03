/** Partial CSS style declaration for inline styling */
export type Style = Partial<CSSStyleDeclaration>

/** Map of style names to style values or CSS declarations */
export interface StyleMap {
  [key: string]: string | Style
}
