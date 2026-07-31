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
 * A link URL split into the part mapping rules match on and its fragment.
 */
export interface AnchorSplitResult {
  /** The URL without its trailing `#fragment` */
  path: string
  /** The trailing `#fragment`, or an empty string when the link carries none */
  anchor: string
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
