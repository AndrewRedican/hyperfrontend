/**
 * Result of extracting a markdown link.
 */
export interface MarkdownLinkResult {
  /** The text content of the link */
  linkText: string
  /** The URL the link points to */
  url: string
  /** Text remaining after the link */
  remainder: string
}

/**
 * Result of transforming a link URL.
 */
export interface TransformLinkResult {
  /** The transformed URL, or null to remove the link */
  url: string | null
  /** Whether to keep the link text when URL is removed */
  keepAsText: boolean
}

/**
 * Result of extracting content from a file.
 */
export interface ContentExtractionResult {
  /** The extracted content */
  content: string
  /** Whether the source file exists */
  exists: boolean
}
