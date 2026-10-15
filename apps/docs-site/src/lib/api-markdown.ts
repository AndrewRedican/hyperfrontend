import type { ApiModule, KindGroups } from '@/components/api-reference/api-exports'
import type { Example } from '@/components/api-reference/type-utils'
import type { Parameter, Signature, TypeDocNode, TypeDocOutput } from '@/components/api-reference/types'
import {
  accessorSignature,
  collectModules,
  countGroups,
  flattenExports,
  groupByKind,
  groupMembers,
  hasModules,
  homeModules,
  memberComment,
  memberModifiers,
  moduleImportPath,
  scopedExports,
} from '@/components/api-reference/api-exports'
import {
  getDescription,
  getExamples,
  getParamDescriptions,
  getReturnsDescription,
  parameterSegments,
  renderType,
  signatureText,
} from '@/components/api-reference/type-utils'
import { ReflectionKind } from '@/components/api-reference/types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Which reference a page renders, and so which one its markdown counterpart carries. */
export interface ApiMarkdownOptions {
  /** The package's npm name */
  packageName: string
  /** The secondary entry point to scope to; omitted for the package's own page */
  subpath?: string
}

/** Heading text the page gives the reference section, kept identical so the two agree. */
const API_REFERENCE_HEADING = 'API Reference'

/** The kind sections in the order the page lists them. */
const KIND_SECTIONS: Array<[keyof KindGroups, string]> = [
  ['functions', 'Functions'],
  ['classes', 'Classes'],
  ['interfaces', 'Interfaces'],
  ['types', 'Types'],
  ['variables', 'Variables'],
  ['enums', 'Enums'],
  ['namespaces', 'Namespaces'],
]

/**
 * A markdown heading at a depth, capped at the six levels markdown has.
 *
 * @param depth - How many levels down the outline the line sits
 * @param text - What the line says
 * @returns The line, hashes included
 */
function heading(depth: number, text: string): string {
  return `${'#'.repeat(min(depth, 6))} ${text}`
}

/**
 * Text fit for one table cell: on one line, with the pipes that would split it escaped.
 *
 * @param text - The text as authored
 * @returns The cell contents
 */
function cell(text: string): string {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

/**
 * A type expression as a code span that survives a table cell.
 *
 * @param text - The rendered type
 * @returns The code span
 */
function typeSpan(text: string): string {
  return `\`${text.replace(/\|/g, '\\|')}\``
}

/**
 * A fenced code block.
 *
 * @param code - What goes between the fences
 * @param language - Syntax the fence announces, TypeScript unless told otherwise
 * @returns The opening fence, the contents and the closing fence
 */
function fence(code: string, language = 'typescript'): string[] {
  return [`\`\`\`${language}`, code, '```']
}

/**
 * An example as the page shows it: a labelled, fenced block. TypeDoc keeps the fence an
 * author wrote, so a block that already has one is used as it is.
 *
 * @param example - The example's code and label
 * @param example.label - Optional label
 * @param example.code - The example source
 * @returns The example's lines
 */
function exampleBlock({ label, code }: Example): string[] {
  const trimmed = code.trim()
  const block = trimmed.startsWith('```') ? [trimmed] : fence(trimmed)
  return [`**Example${label ? `: ${label}` : ''}**`, '', ...block]
}

/**
 * A parameter table with one row per parameter, matching the page's table.
 *
 * @param parameters - The signature's parameters
 * @param descriptions - Descriptions by parameter name, from the signature's `@param` tags
 * @returns The table's lines, empty when there are no parameters
 */
function parameterTable(parameters: Parameter[] | undefined, descriptions: Record<string, string>): string[] {
  if (!parameters || parameters.length === 0) return []
  const rows = parameters.map((parameter) => {
    const name = `${parameter.flags?.isRest ? '...' : ''}${parameter.name}${parameter.flags?.isOptional ? '?' : ''}`
    const description = descriptions[parameter.name] || getDescription(parameter.comment)
    const fallback = parameter.defaultValue ? ` (default: \`${parameter.defaultValue}\`)` : ''
    return `| \`${name}\` | ${typeSpan(renderType(parameter.type))} | ${cell(description)}${fallback} |`
  })
  return ['**Parameters**', '', '| Name | Type | Description |', '| --- | --- | --- |', ...rows]
}

/**
 * Everything one signature documents after its declaration line: description, parameters,
 * return value and examples.
 *
 * @param signature - The signature whose comment is rendered
 * @param withReturns - Whether to print what it returns; a constructor returns its class
 * @returns The lines, blank-line separated
 */
function signatureDetails(signature: Signature, withReturns: boolean): string[] {
  const blocks: string[][] = []
  const description = getDescription(signature.comment).trim()
  if (description) blocks.push([description])
  blocks.push(parameterTable(signature.parameters, getParamDescriptions(signature.comment)))
  const returns = getReturnsDescription(signature.comment).trim()
  if (withReturns && returns) blocks.push([`**Returns** ${typeSpan(renderType(signature.type))}: ${cell(returns)}`])
  for (const example of getExamples(signature.comment)) blocks.push(exampleBlock(example))
  return joinBlocks(blocks)
}

/**
 * Join blocks of lines with one blank line between the non-empty ones.
 *
 * @param blocks - Runs of lines, some of them possibly empty
 * @returns One run of lines with the empty blocks dropped
 */
function joinBlocks(blocks: string[][]): string[] {
  const lines: string[] = []
  for (const block of blocks) {
    if (block.length === 0) continue
    if (lines.length > 0) lines.push('')
    lines.push(...block)
  }
  return lines
}

/**
 * A function declaration: one fenced declaration and one set of details per signature.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function functionEntry(node: TypeDocNode, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, node.name)]]
  for (const signature of node.signatures ?? []) {
    blocks.push(fence(`function ${node.name}${signatureText(signature)}`))
    blocks.push(signatureDetails(signature, true))
  }
  return joinBlocks(blocks)
}

/**
 * The name column of a member row: its modifiers, accessor keywords, name and optional marker.
 *
 * @param member - The property or accessor the row describes
 * @returns The column's contents as one code span
 */
function memberName(member: TypeDocNode): string {
  const keywords = [...memberModifiers(member.flags)]
  if (member.kind === ReflectionKind.Accessor) {
    if (member.getSignature) keywords.push('get')
    if (member.setSignature) keywords.push('set')
  }
  const prefix = keywords.length > 0 ? `${keywords.join(' ')} ` : ''
  return `\`${prefix}${member.name}${member.flags?.isOptional ? '?' : ''}\``
}

/**
 * The property table of a class or interface, accessors included in declaration order.
 *
 * @param members - Properties and accessors in the order to list them
 * @returns The table's lines, empty when there are none
 */
function propertyTable(members: TypeDocNode[]): string[] {
  if (members.length === 0) return []
  const rows = members.map((member) => {
    const type = member.kind === ReflectionKind.Accessor ? accessorSignature(member)?.type : member.type
    return `| ${memberName(member)} | ${typeSpan(renderType(type))} | ${cell(getDescription(memberComment(member)))} |`
  })
  return ['**Properties**', '', '| Name | Type | Description |', '| --- | --- | --- |', ...rows]
}

/**
 * A callable member: a heading, one fenced declaration and one set of details per signature.
 *
 * @param member - The method or constructor to render
 * @param parentName - The class or interface it belongs to
 * @param depth - Heading depth of the member
 * @returns The entry's lines
 */
function callableEntry(member: TypeDocNode, parentName: string, depth: number): string[] {
  const isConstructor = member.kind === ReflectionKind.Constructor
  const label = isConstructor ? `new ${parentName}` : member.name
  const modifiers = memberModifiers(member.flags)
  const prefix = modifiers.length > 0 ? `${modifiers.join(' ')} ` : ''
  const blocks: string[][] = [[heading(depth, isConstructor ? 'Constructor' : member.name)]]
  for (const signature of member.signatures ?? []) {
    const declaration = isConstructor
      ? `${label}${parameterSegments(signature)
          .map((segment) => segment.text)
          .join('')}`
      : `${prefix}${label}${signatureText(signature)}`
    blocks.push(fence(declaration))
    blocks.push(signatureDetails(signature, !isConstructor))
  }
  return joinBlocks(blocks)
}

/**
 * A class or interface: description, constructor, properties, methods and examples, in the
 * order the page shows them.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function typeEntry(node: TypeDocNode, depth: number): string[] {
  const members = groupMembers(node)
  const properties = [...members.properties, ...members.accessors].sort((a, b) => (a.sources?.[0]?.line ?? 0) - (b.sources?.[0]?.line ?? 0))
  const blocks: string[][] = [[heading(depth, node.name)]]
  const description = getDescription(node.comment).trim()
  if (description) blocks.push([description])
  for (const constructor of members.constructors) blocks.push(callableEntry(constructor, node.name, depth + 1))
  blocks.push(propertyTable(properties))
  for (const method of members.methods) blocks.push(callableEntry(method, node.name, depth + 1))
  for (const example of getExamples(node.comment)) blocks.push(exampleBlock(example))
  return joinBlocks(blocks)
}

/**
 * A type alias: its description and the type it names.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function aliasEntry(node: TypeDocNode, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, node.name)]]
  const description = getDescription(node.comment).trim()
  if (description) blocks.push([description])
  blocks.push(fence(`type ${node.name} = ${renderType(node.type)}`))
  return joinBlocks(blocks)
}

/**
 * A variable or constant: its description, its type and the value it holds.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function variableEntry(node: TypeDocNode, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, node.name)]]
  const description = getDescription(node.comment).trim()
  if (description) blocks.push([description])
  blocks.push(fence(`const ${node.name}: ${renderType(node.type)}`))
  if (node.defaultValue) blocks.push([`**Value** \`${node.defaultValue}\``])
  return joinBlocks(blocks)
}

/**
 * An enum: its description and a table of its members.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function enumEntry(node: TypeDocNode, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, node.name)]]
  const description = getDescription(node.comment).trim()
  if (description) blocks.push([description])
  const rows = (node.children ?? []).map(
    (member) => `| \`${member.name}\` | ${typeSpan(renderType(member.type))} | ${cell(getDescription(member.comment))} |`
  )
  if (rows.length > 0) blocks.push(['| Member | Value | Description |', '| --- | --- | --- |', ...rows])
  return joinBlocks(blocks)
}

/**
 * A namespace: its description and every export inside it, one level deeper.
 *
 * @param node - The declaration to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function namespaceEntry(node: TypeDocNode, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, node.name)]]
  const description = getDescription(node.comment).trim()
  if (description) blocks.push([description])
  for (const child of node.children ?? []) blocks.push(declarationEntry(child, depth + 1))
  return joinBlocks(blocks)
}

/**
 * One declaration, rendered by its kind.
 *
 * @param node - What to render
 * @param depth - Heading depth of the symbol
 * @returns The entry's lines
 */
function declarationEntry(node: TypeDocNode, depth: number): string[] {
  switch (node.kind) {
    case ReflectionKind.Function:
      return functionEntry(node, depth)
    case ReflectionKind.Class:
    case ReflectionKind.Interface:
      return typeEntry(node, depth)
    case ReflectionKind.TypeAlias:
      return aliasEntry(node, depth)
    case ReflectionKind.Variable:
      return variableEntry(node, depth)
    case ReflectionKind.Enum:
      return enumEntry(node, depth)
    case ReflectionKind.Namespace:
      return namespaceEntry(node, depth)
    default:
      return [heading(depth, node.name)]
  }
}

/**
 * The kind sections of one list of declarations, each symbol one level under its section.
 *
 * @param groups - Declarations sorted by kind
 * @param depth - Heading depth of the kind sections
 * @returns Every section's lines, in page order
 */
function kindSections(groups: KindGroups, depth: number): string[] {
  const blocks: string[][] = []
  for (const [key, title] of KIND_SECTIONS) {
    const nodes = groups[key]
    if (nodes.length === 0) continue
    blocks.push([heading(depth, title)])
    for (const node of nodes) blocks.push(declarationEntry(node, depth + 1))
  }
  return joinBlocks(blocks)
}

/**
 * One entry point of a multi-entry package: the declarations it is home to in full, and
 * the ones documented under a more specific entry point by name.
 *
 * @param module - The entry point to render
 * @param homes - Each declaration's home module, from {@link homeModules}
 * @param packageName - The package's npm name
 * @param depth - Heading depth of the module
 * @returns The section's lines
 */
function moduleSection(module: ApiModule, homes: Map<number, string>, packageName: string, depth: number): string[] {
  const blocks: string[][] = [[heading(depth, moduleImportPath(packageName, module.name))]]
  if (module.description) blocks.push([module.description])

  const own = module.exports.filter((node) => homes.get(node.id) === module.name)
  const elsewhere = createMap<string, string[]>()
  for (const node of module.exports) {
    const home = homes.get(node.id)
    if (home === undefined || home === module.name) continue
    elsewhere.set(home, [...(elsewhere.get(home) ?? []), node.name])
  }

  blocks.push(kindSections(groupByKind(own), depth + 1))

  if (elsewhere.size > 0) {
    const lines = ['Also exported here, documented under the entry point that owns each:', '']
    for (const [home, names] of [...elsewhere].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`- \`${moduleImportPath(packageName, home)}\`: ${names.map((name) => `\`${name}\``).join(', ')}`)
    }
    blocks.push(lines)
  }

  return joinBlocks(blocks)
}

/**
 * The API reference a documentation page renders, as markdown.
 *
 * The same TypeDoc bundle the page reads is rendered to headings, fenced declarations and
 * tables, so the markdown counterpart of a page carries the reference the page shows and
 * nothing the page does not. A secondary entry point's page scopes to that entry point. A
 * package page with several entry points groups by entry point and documents each
 * declaration once, under the most specific entry point that exports it, listing it by name
 * under the others; a package with one entry point lists its exports by kind.
 *
 * @param data - TypeDoc output for the package
 * @param options - Which reference the page renders
 * @returns The reference section, or null when the page renders none
 * @example
 * ```typescript
 * renderApiReferenceMarkdown(api, { packageName: '@hyperfrontend/state-machine', subpath: 'events' })
 * // '## API Reference\n\n### Classes\n\n#### Events\n...'
 * ```
 */
export function renderApiReferenceMarkdown(data: TypeDocOutput, options: ApiMarkdownOptions): string | null {
  const blocks: string[][] = [[heading(2, API_REFERENCE_HEADING)]]

  if (options.subpath !== undefined) {
    const exports = scopedExports(data, options.packageName, options.subpath)
    if (exports === null) return null
    const groups = groupByKind(exports)
    if (countGroups(groups) === 0) return null
    blocks.push(kindSections(groups, 3))
    return joinBlocks(blocks).join('\n')
  }

  if (hasModules(data)) {
    const modules = collectModules(data)
    if (modules.every((module) => module.exports.length === 0)) return null
    const homes = homeModules(modules)
    blocks.push([
      'Grouped by entry point. A declaration exported from several entry points is documented once, under the most specific one, and listed by name under the others.',
    ])
    for (const module of modules) blocks.push(moduleSection(module, homes, options.packageName, 3))
    return joinBlocks(blocks).join('\n')
  }

  const groups = groupByKind(flattenExports(data))
  if (countGroups(groups) === 0) return null
  blocks.push(kindSections(groups, 3))
  return joinBlocks(blocks).join('\n')
}
