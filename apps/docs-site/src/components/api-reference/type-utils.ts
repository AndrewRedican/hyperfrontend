import type { TypeRef, TextBlock, Comment, TypeDocOutput, TypeDocNode } from './types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ReflectionKind } from './types'

/**
 * Render a TypeRef to a human-readable type string
 *
 * @param type - The TypeRef to render
 * @returns Human-readable type string representation
 */
export function renderType(type: TypeRef | undefined): string {
  if (!type) return 'unknown'

  switch (type.type) {
    case 'intrinsic':
      return type.name || 'unknown'

    case 'literal':
      if (typeof type.value === 'string') return `"${type.value}"`
      if (typeof type.value === 'number' || typeof type.value === 'boolean') return String(type.value)
      if (type.value === null) return 'null'
      return String(type.value)

    case 'reference': {
      let refName = type.name || 'unknown'
      if (type.typeArguments && type.typeArguments.length > 0) {
        const args = type.typeArguments.map(renderType).join(', ')
        refName += `<${args}>`
      }
      return refName
    }

    case 'array':
      if (type.elementType) {
        const elementType = renderType(type.elementType)
        if (type.elementType.type === 'union' || type.elementType.type === 'intersection') {
          return `(${elementType})[]`
        }
        return `${elementType}[]`
      }
      return 'unknown[]'

    case 'union':
      if (type.types) {
        return type.types.map(renderType).join(' | ')
      }
      return 'unknown'

    case 'intersection':
      if (type.types) {
        return type.types.map(renderType).join(' & ')
      }
      return 'unknown'

    case 'tuple':
      if (type.elements) {
        return `[${type.elements.map(renderType).join(', ')}]`
      }
      return '[]'

    case 'rest':
      if (type.elementType) {
        return `...${renderType(type.elementType)}`
      }
      return '...unknown'

    case 'reflection':
      if (type.declaration?.signatures?.[0]) {
        const sig = type.declaration.signatures[0]
        const params = sig.parameters?.map((p) => `${p.name}${p.flags?.isOptional ? '?' : ''}: ${renderType(p.type)}`).join(', ') ?? ''
        const returnType = renderType(sig.type)
        return `(${params}) => ${returnType}`
      }
      if (type.declaration?.children) {
        const props = type.declaration.children.map((child) => `${child.name}: ${renderType(child.type)}`).join('; ')
        return `{ ${props} }`
      }
      return '{ }'

    case 'conditional':
      return 'conditional'

    case 'mapped':
      return 'mapped'

    case 'indexedAccess':
      return 'indexedAccess'

    case 'templateLiteral':
      return 'templateLiteral'

    default:
      return 'unknown'
  }
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
 * Extract description from a comment
 *
 * @param comment - The comment to extract description from
 * @returns Description text from the comment summary
 */
export function getDescription(comment: Comment | undefined): string {
  if (!comment?.summary) return ''
  return renderTextBlocks(comment.summary)
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
  return renderTextBlocks(returnsTag.content)
}

/**
 * Extract example blocks from a comment
 *
 * @param comment - The comment to extract examples from
 * @returns Array of example code strings
 */
export function getExamples(comment: Comment | undefined): string[] {
  if (!comment?.blockTags) return []
  return comment.blockTags.filter((tag) => tag.tag === '@example').map((tag) => renderTextBlocks(tag.content))
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
  return renderTextBlocks(remarksTag.content)
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
        result[tag.name] = raw.startsWith('-') ? raw.slice(1).trim() : raw
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
