import type { KindGroups } from './api-exports'
import type { TypeDocNode, TypeDocOutput } from './types'
import { AnchorLink } from '../anchor-link'
import { H2 } from '../heading-with-anchor'
import { countGroups, groupByKind, scopedExports } from './api-exports'
import { FunctionSignature } from './function-signature'
import { TypeDefinition } from './type-definition'
import { ReflectionKind } from './types'

interface ScopedApiReferenceProps {
  /** Parsed TypeDoc output for the library */
  data: TypeDocOutput
  /** Full npm package name (e.g., '@hyperfrontend/versioning'). */
  packageName: string
  /** Subpath identifying the secondary entrypoint (e.g., 'commits/parse'). */
  subpath: string
}

/**
 * Locates the TypeDoc Module node for a given subpath and groups its exports by kind.
 * @param data - The TypeDoc output for the library.
 * @param packageName - The library's npm package name.
 * @param subpath - The secondary entrypoint subpath to resolve.
 * @returns The grouped exports, or null when the module is not present.
 */
function getScopedExports(data: TypeDocOutput, packageName: string, subpath: string): KindGroups | null {
  const exports = scopedExports(data, packageName, subpath)
  return exports === null ? null : groupByKind(exports)
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
    <div className="pt-8 pb-3 first:pt-0" id={`api-${node.name}`}>
      <div className="flex items-center gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <h4 className="api-symbol min-w-0 text-slate-900 dark:text-white">{node.name}</h4>
        <span className="text-xs text-slate-500 dark:text-slate-400">({node.children.length} exports)</span>
      </div>
      <div className="mt-3 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
        {node.children.map((child) =>
          child.kind === ReflectionKind.Function ? (
            <FunctionSignature key={child.id} node={child} level={4} />
          ) : (
            <TypeDefinition key={child.id} node={child} level={4} />
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
 * Whether a secondary entrypoint has a scoped API reference to show.
 *
 * The page that mounts {@link ScopedApiReference} has to know this before it
 * renders: its document index lists the reference as a section, and an entry
 * pointing at a heading that never renders is a dead link.
 * @param data - The TypeDoc output for the parent library
 * @param packageName - The library's npm package name
 * @param subpath - The secondary entrypoint subpath
 * @returns True when the module resolves and exports at least one symbol
 * @example
 * ```typescript
 * hasScopedApiReference(apiData, '@hyperfrontend/features', 'host')  // true
 * ```
 */
export function hasScopedApiReference(data: TypeDocOutput, packageName: string, subpath: string): boolean {
  const exports = getScopedExports(data, packageName, subpath)
  return exports !== null && countGroups(exports) > 0
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
 * @param props.packageName - The library's npm package name (used to qualify module names).
 * @param props.subpath - The secondary entrypoint subpath to render.
 * @returns The scoped API reference, or null when the module isn't found.
 * @example
 * <ScopedApiReference data={apiData} packageName="@hyperfrontend/versioning" subpath="commits/parse" />
 */
export function ScopedApiReference({ data, packageName, subpath }: ScopedApiReferenceProps) {
  const exports = getScopedExports(data, packageName, subpath)

  if (!exports) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">
        API reference for <code className="font-mono">{subpath}</code> is not available yet; rebuild docs to regenerate.
      </div>
    )
  }

  if (countGroups(exports) === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">No exported symbols in this module.</div>
  }

  return (
    <div className="scoped-api-reference">
      {/* why: the same id and anchor the package page gives its reference, so one address form reaches it from anywhere it is published */}
      <H2
        id="api-reference"
        className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 pt-4 border-t border-slate-200 dark:border-slate-700"
      >
        API Reference
      </H2>

      {exports.functions.length > 0 && (
        <Section heading="Functions" iconClass="text-blue-500" icon="ƒ" anchor="functions">
          {exports.functions.map((node) => (
            <FunctionSignature key={node.id} node={node} level={4} />
          ))}
        </Section>
      )}

      {exports.classes.length > 0 && (
        <Section heading="Classes" iconClass="text-amber-500" icon="◇" anchor="classes">
          {exports.classes.map((node) => (
            <TypeDefinition key={node.id} node={node} level={4} />
          ))}
        </Section>
      )}

      {exports.interfaces.length > 0 && (
        <Section heading="Interfaces" iconClass="text-purple-500" icon="◈" anchor="interfaces">
          {exports.interfaces.map((node) => (
            <TypeDefinition key={node.id} node={node} level={4} />
          ))}
        </Section>
      )}

      {exports.types.length > 0 && (
        <Section heading="Types" iconClass="text-teal-500" icon="◆" anchor="types">
          {exports.types.map((node) => (
            <TypeDefinition key={node.id} node={node} level={4} />
          ))}
        </Section>
      )}

      {exports.variables.length > 0 && (
        <Section heading="Variables" iconClass="text-green-500" icon="●" anchor="variables">
          {exports.variables.map((node) => (
            <TypeDefinition key={node.id} node={node} level={4} />
          ))}
        </Section>
      )}

      {exports.enums.length > 0 && (
        <Section heading="Enums" iconClass="text-orange-500" icon="⬡" anchor="enums">
          {exports.enums.map((node) => (
            <TypeDefinition key={node.id} node={node} level={4} />
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
