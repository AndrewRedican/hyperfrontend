import type { TypeRef, TextBlock, Comment, TypeDocOutput, TypeDocNode } from './types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ReflectionKind } from './types'

/** One run of rendered type text, optionally carrying a link target. */
export interface TypeSegment {
  /** The literal text of this run */
  text: string
  /** Destination URL for the type name, when a resolver produced one */
  href?: string
  /** Whether the destination leaves the docs site */
  external?: boolean
}

/** Link target for a referenced type name. */
export interface TypeLinkTarget {
  /** Destination URL — site-relative for hyperfrontend types, absolute for external references */
  href: string
  /** Whether the destination leaves the docs site */
  external?: boolean
}

/** Produces the link target for a reference type, or undefined to render it as plain text. */
export type TypeLinkResolver = (type: TypeRef) => TypeLinkTarget | undefined

/**
 * Render a TypeRef to a list of text segments, linking referenced type names
 * through the given resolver
 *
 * @param type - The TypeRef to render
 * @param resolve - Resolver mapping a reference type to a link target
 * @returns Segments that concatenate to the human-readable type string
 */
export function renderTypeSegments(type: TypeRef | undefined, resolve?: TypeLinkResolver): TypeSegment[] {
  if (!type) return [{ text: 'unknown' }]

  const render = (inner: TypeRef | undefined): TypeSegment[] => renderTypeSegments(inner, resolve)

  /**
   * Joins rendered segment lists with a plain-text separator.
   *
   * @param parts - Segment lists to join
   * @param separator - Literal text placed between the lists
   * @returns The flattened, separated segment list
   */
  const joinSegments = (parts: TypeSegment[][], separator: string): TypeSegment[] =>
    parts.flatMap((part, index) => (index === 0 ? part : [{ text: separator }, ...part]))

  switch (type.type) {
    case 'intrinsic':
      return [{ text: type.name || 'unknown' }]

    case 'literal':
      if (typeof type.value === 'string') return [{ text: `"${type.value}"` }]
      if (typeof type.value === 'number' || typeof type.value === 'boolean') return [{ text: String(type.value) }]
      if (type.value === null) return [{ text: 'null' }]
      return [{ text: String(type.value) }]

    case 'reference': {
      const target = type.refersToTypeParameter ? undefined : resolve?.(type)
      const name: TypeSegment = target
        ? { text: type.name || 'unknown', href: target.href, external: target.external }
        : { text: type.name || 'unknown' }
      if (type.typeArguments && type.typeArguments.length > 0) {
        const args = joinSegments(type.typeArguments.map(render), ', ')
        return [name, { text: '<' }, ...args, { text: '>' }]
      }
      return [name]
    }

    case 'array':
      if (type.elementType) {
        const elementType = render(type.elementType)
        if (type.elementType.type === 'union' || type.elementType.type === 'intersection') {
          return [{ text: '(' }, ...elementType, { text: ')[]' }]
        }
        return [...elementType, { text: '[]' }]
      }
      return [{ text: 'unknown[]' }]

    case 'union':
      if (type.types) {
        return joinSegments(type.types.map(render), ' | ')
      }
      return [{ text: 'unknown' }]

    case 'intersection':
      if (type.types) {
        return joinSegments(type.types.map(render), ' & ')
      }
      return [{ text: 'unknown' }]

    case 'tuple':
      if (type.elements) {
        return [{ text: '[' }, ...joinSegments(type.elements.map(render), ', '), { text: ']' }]
      }
      return [{ text: '[]' }]

    case 'rest':
      if (type.elementType) {
        return [{ text: '...' }, ...render(type.elementType)]
      }
      return [{ text: '...unknown' }]

    case 'reflection':
      if (type.declaration?.signatures?.[0]) {
        const sig = type.declaration.signatures[0]
        const params = joinSegments(
          sig.parameters?.map((p) => [{ text: `${p.name}${p.flags?.isOptional ? '?' : ''}: ` }, ...render(p.type)]) ?? [],
          ', '
        )
        return [{ text: '(' }, ...params, { text: ') => ' }, ...render(sig.type)]
      }
      if (type.declaration?.children) {
        const props = joinSegments(
          type.declaration.children.map((child) => [{ text: `${child.name}: ` }, ...render(child.type)]),
          '; '
        )
        return [{ text: '{ ' }, ...props, { text: ' }' }]
      }
      return [{ text: '{ }' }]

    case 'conditional':
      return [{ text: 'conditional' }]

    case 'mapped':
      return [{ text: 'mapped' }]

    case 'indexedAccess':
      return [{ text: 'indexedAccess' }]

    case 'templateLiteral':
      return [{ text: 'templateLiteral' }]

    default:
      return [{ text: 'unknown' }]
  }
}

/**
 * Render a TypeRef to a human-readable type string
 *
 * @param type - The TypeRef to render
 * @returns Human-readable type string representation
 */
export function renderType(type: TypeRef | undefined): string {
  return renderTypeSegments(type)
    .map((segment) => segment.text)
    .join('')
}

/**
 * Render text blocks to a plain string
 *
 * @param blocks - Array of text blocks to render
 * @returns Concatenated plain text string
 */
export function renderTextBlocks(blocks: TextBlock[] | undefined): string {
  if (!blocks) return ''
  return blocks.map((block) => block.text).join('')
}

/**
 * Strip a leading dash-style name/description separator from extracted JSDoc
 * text. TypeDoc removes only the ASCII `-` form of `@param name - description`,
 * so em/en dash separators would otherwise leak into rendered descriptions.
 *
 * @param text - The extracted text to normalize
 * @returns The text without a leading dash separator
 */
function stripLeadingDashSeparator(text: string): string {
  return text.replace(/^\s*[—–]\s*/, '')
}

/**
 * Extract description from a comment
 *
 * @param comment - The comment to extract description from
 * @returns Description text from the comment summary
 */
export function getDescription(comment: Comment | undefined): string {
  if (!comment?.summary) return ''
  return stripLeadingDashSeparator(renderTextBlocks(comment.summary))
}

/**
 * Extract returns tag content from a comment
 *
 * @param comment - The comment to extract returns description from
 * @returns Text from the `@returns` tag
 */
export function getReturnsDescription(comment: Comment | undefined): string {
  if (!comment?.blockTags) return ''
  const returnsTag = comment.blockTags.find((tag) => tag.tag === '@returns')
  if (!returnsTag) return ''
  return stripLeadingDashSeparator(renderTextBlocks(returnsTag.content))
}

/** An example block with optional label */
export interface Example {
  /** Optional label for the example (e.g., "6-digit hex") */
  label?: string
  /** The example code */
  code: string
}

/**
 * Extract example blocks from a comment
 *
 * @param comment - The comment to extract examples from
 * @returns Array of example objects with label and code
 */
export function getExamples(comment: Comment | undefined): Example[] {
  if (!comment?.blockTags) return []
  return comment.blockTags
    .filter((tag) => tag.tag === '@example')
    .map((tag) => ({
      label: tag.name,
      code: renderTextBlocks(tag.content),
    }))
}

/**
 * Extract remarks content from a comment
 *
 * @param comment - The comment to extract remarks from
 * @returns Text from the `@remarks` tag
 */
export function getRemarks(comment: Comment | undefined): string {
  if (!comment?.blockTags) return ''
  const remarksTag = comment.blockTags.find((tag) => tag.tag === '@remarks')
  if (!remarksTag) return ''
  return stripLeadingDashSeparator(renderTextBlocks(remarksTag.content))
}

/**
 * Extract param descriptions from a comment by parameter name
 *
 * @param comment - The comment to extract param descriptions from
 * @returns Record mapping parameter names to their descriptions
 */
export function getParamDescriptions(comment: Comment | undefined): Record<string, string> {
  if (!comment?.blockTags) return {}
  const result: Record<string, string> = {}
  comment.blockTags
    .filter((tag) => tag.tag === '@param' && tag.name)
    .forEach((tag) => {
      if (tag.name) {
        const raw = renderTextBlocks(tag.content).trim()
        result[tag.name] = raw.replace(/^[-—–]\s*/, '')
      }
    })
  return result
}

/**
 * Builds a lookup map of node ID to TypeDocNode.
 * Traverses the entire TypeDoc output tree to index all nodes.
 *
 * @param data - TypeDoc output data to index
 * @returns Map from node ID to TypeDocNode
 */
export function buildNodeLookup(data: TypeDocOutput): Map<number, TypeDocNode> {
  const lookup = createMap<number, TypeDocNode>()

  /**
   * Recursively traverses a TypeDocNode and its children to populate the lookup map.
   *
   * @param node - The node to traverse and index
   */
  function traverse(node: TypeDocNode) {
    lookup.set(node.id, node)
    if (node.children) {
      node.children.forEach(traverse)
    }
  }

  if (data.children) {
    data.children.forEach(traverse)
  }

  return lookup
}

/**
 * Resolves a Reference node to its target declaration.
 * If the node is a Reference (kind 4194304), returns the target declaration.
 * Otherwise returns the node unchanged.
 *
 * @param node - The node to potentially resolve
 * @param lookup - Map of node IDs to TypeDocNodes
 * @returns The resolved target declaration or the original node
 */
export function resolveReference(node: TypeDocNode, lookup: Map<number, TypeDocNode>): TypeDocNode {
  if (node.kind === ReflectionKind.Reference && node.target !== undefined) {
    return lookup.get(node.target) ?? node
  }
  return node
}

/**
 * Extract the module description from a comment.
 * First checks for `@module` block tag content, then falls back to summary.
 *
 * @param comment - The comment to extract module description from
 * @returns Description text from the `@module` tag or summary
 */
export function getModuleDescription(comment: Comment | undefined): string {
  if (!comment) return ''

  if (comment.blockTags) {
    const moduleTag = comment.blockTags.find((tag) => tag.tag === '@module')
    if (moduleTag) {
      const content = stripLeadingDashSeparator(renderTextBlocks(moduleTag.content).trim())
      if (content) return content
    }
  }

  return stripLeadingDashSeparator(renderTextBlocks(comment.summary))
}
