import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

interface JsonLdProps {
  /** Structured-data object serialized into the script tag. */
  data: Record<string, unknown>
}

/**
 * Renders a schema.org JSON-LD script tag for search-engine structured data.
 * @param props - Component props
 * @param props.data - Structured-data object serialized into the script tag
 */
export function JsonLd({ data }: JsonLdProps) {
  // why: '<' is escaped so serialized content can never terminate the script tag early
  const json = stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
