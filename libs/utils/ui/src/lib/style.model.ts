/* istanbul ignore file */
export type Style = Partial<CSSStyleDeclaration>

export interface StyleMap {
  [key: string]: string | Style
}
