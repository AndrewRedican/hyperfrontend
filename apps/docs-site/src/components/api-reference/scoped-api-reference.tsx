import type { TypeDocNode, TypeDocOutput } from './types'
import { FunctionSignature } from './function-signature'
import { TypeDefinition } from './type-definition'
import { buildNodeLookup, resolveReference } from './type-utils'
import { ReflectionKind } from './types'

interface ScopedApiReferenceProps {
  /** Parsed TypeDoc output for the library */
  data: TypeDocOutput
  /** Subpath identifying the secondary entrypoint (e.g., 'commits/parse'). */
  subpath: string
}

interface ScopedExports {
  /** Function declarations exported by the module */
  functions: TypeDocNode[]
  /** Class declarations exported by the module */
  classes: TypeDocNode[]
  /** Interface declarations exported by the module */
  interfaces: TypeDocNode[]
  /** Type alias declarations exported by the module */
  types: TypeDocNode[]
  /** Variable/constant declarations exported by the module */
  variables: TypeDocNode[]
  /** Namespace declarations exported by the module */
  namespaces: TypeDocNode[]
}

/**
 * Locates the TypeDoc Module node for a given subpath and groups its exports.
 * @param data - The TypeDoc output for the library.
 * @param subpath - The secondary entrypoint subpath to resolve.
 * @returns The grouped exports, or null when the module is not present.
 */
function getScopedExports(data: TypeDocOutput, subpath: string): ScopedExports | null {
  if (!data.children) return null

  const moduleNode = data.children.find((child) => child.kind === ReflectionKind.Module && child.name === subpath)
  if (!moduleNode || !moduleNode.children) return null

  const lookup = buildNodeLookup(data)
  const resolved = moduleNode.children.map((child) => resolveReference(child, lookup))

  return {
    functions: resolved.filter((node) => node.kind === ReflectionKind.Function),
    classes: resolved.filter((node) => node.kind === ReflectionKind.Class),
    interfaces: resolved.filter((node) => node.kind === ReflectionKind.Interface),
    types: resolved.filter((node) => node.kind === ReflectionKind.TypeAlias),
    variables: resolved.filter((node) => node.kind === ReflectionKind.Variable),
    namespaces: resolved.filter((node) => node.kind === ReflectionKind.Namespace),
  }
}

interface NamespaceListingProps {
  /** Namespace node to render */
  node: TypeDocNode
}

/**
 * Renders a namespace's children inline. Server-only — no toggle state.
 * @param props - Component props.
 * @param props.node - Namespace node whose children to render.
 */
function NamespaceListing({ node }: NamespaceListingProps) {
  if (!node.children || node.children.length === 0) return null

  return (
    <div className="py-3 first:pt-0" id={`api-${node.name}`}>
      <code className="text-sm font-semibold text-slate-900 dark:text-white font-mono">{node.name}</code>
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({node.children.length} exports)</span>
      <div className="mt-3 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
        {node.children.map((child) =>
          child.kind === ReflectionKind.Function ? (
            <FunctionSignature key={child.id} node={child} />
          ) : (
            <TypeDefinition key={child.id} node={child} />
          )
        )}
      </div>
    </div>
  )
}

interface SectionProps {
  /** Section heading label */
  heading: string
  /** Hex glyph indicator color class */
  iconClass: string
  /** Section glyph */
  icon: string
  /** Anchor id slug, e.g., 'functions' renders to '#scoped-api-functions' */
  anchor: string
  /** Children to render below the heading */
  children: React.ReactNode
}

/**
 * Header + container for one Kind group within a scoped API reference.
 * @param props - Component props.
 * @param props.heading - Plain-text heading (e.g., "Functions").
 * @param props.iconClass - Tailwind text color class for the glyph.
 * @param props.icon - Glyph character.
 * @param props.anchor - Slug appended to `#scoped-api-` to form the section id.
 * @param props.children - Rendered exports.
 */
function Section({ heading, iconClass, icon, anchor, children }: SectionProps) {
  return (
    <section id={`scoped-api-${anchor}`} className="mb-6 last:mb-0">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
        <span className={iconClass}>{icon}</span> {heading}
      </h3>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">{children}</div>
    </section>
  )
}

/**
 * Renders the scoped API reference for a single secondary entrypoint.
 *
 * Filters the library's TypeDoc reflection tree to the Module node whose name matches
 * `subpath`, then renders its exports grouped by reflection kind. Returns null when
 * the module is missing from the TypeDoc data (e.g., the library hasn't been built yet
 * or the entrypoint was just added).
 * @param props - Component props.
 * @param props.data - The TypeDoc output for the parent library.
 * @param props.subpath - The secondary entrypoint subpath to render.
 * @returns The scoped API reference, or null when the module isn't found.
 * @example
 * <ScopedApiReference data={apiData} subpath="commits/parse" />
 */
export function ScopedApiReference({ data, subpath }: ScopedApiReferenceProps) {
  const exports = getScopedExports(data, subpath)

  if (!exports) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">
        API reference for <code className="font-mono">{subpath}</code> is not available yet — rebuild docs to regenerate.
      </div>
    )
  }

  const totalExports =
    exports.functions.length +
    exports.classes.length +
    exports.interfaces.length +
    exports.types.length +
    exports.variables.length +
    exports.namespaces.length

  if (totalExports === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">No exported symbols in this module.</div>
  }

  return (
    <div className="scoped-api-reference">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
        API Reference
      </h2>

      {exports.functions.length > 0 && (
        <Section heading="Functions" iconClass="text-blue-500" icon="ƒ" anchor="functions">
          {exports.functions.map((node) => (
            <FunctionSignature key={node.id} node={node} />
          ))}
        </Section>
      )}

      {exports.classes.length > 0 && (
        <Section heading="Classes" iconClass="text-amber-500" icon="◇" anchor="classes">
          {exports.classes.map((node) => (
            <TypeDefinition key={node.id} node={node} />
          ))}
        </Section>
      )}

      {exports.interfaces.length > 0 && (
        <Section heading="Interfaces" iconClass="text-purple-500" icon="◈" anchor="interfaces">
          {exports.interfaces.map((node) => (
            <TypeDefinition key={node.id} node={node} />
          ))}
        </Section>
      )}

      {exports.types.length > 0 && (
        <Section heading="Types" iconClass="text-teal-500" icon="◆" anchor="types">
          {exports.types.map((node) => (
            <TypeDefinition key={node.id} node={node} />
          ))}
        </Section>
      )}

      {exports.variables.length > 0 && (
        <Section heading="Variables" iconClass="text-green-500" icon="●" anchor="variables">
          {exports.variables.map((node) => (
            <TypeDefinition key={node.id} node={node} />
          ))}
        </Section>
      )}

      {exports.namespaces.length > 0 && (
        <Section heading="Namespaces" iconClass="text-orange-500" icon="⧫" anchor="namespaces">
          {exports.namespaces.map((node) => (
            <NamespaceListing key={node.id} node={node} />
          ))}
        </Section>
      )}
    </div>
  )
}
