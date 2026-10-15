'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { groupMembers } from './api-exports'
import { DescriptionMarkdown } from './description-markdown'
import { ExampleBlock } from './example-block'
import { headingTag } from './heading-level'
import { HighlightMatch } from './highlight-match'
import { AccessorEntry, ConstructorEntry, MethodEntry, PropertyEntry } from './member-list'
import { TYPE_EXPRESSION_ATTRIBUTES, TypeLink } from './type-link'
import { getDescription, getExamples } from './type-utils'
import { ReflectionKind } from './types'

interface TypeDefinitionProps {
  node: TypeDocNode
  searchQuery?: string
  /** Heading level of the symbol's own heading, one under the section it is listed in; defaults to `h3` */
  level?: ApiHeadingLevel
}

export function TypeDefinition({ node, searchQuery = '', level = 3 }: TypeDefinitionProps) {
  const Symbol = headingTag(level)
  const Sub = headingTag((level + 1) as ApiHeadingLevel | 6)
  const description = getDescription(node.comment)
  const examples = getExamples(node.comment)
  const isInterface = node.kind === ReflectionKind.Interface
  const isTypeAlias = node.kind === ReflectionKind.TypeAlias
  const isClass = node.kind === ReflectionKind.Class

  const kindLabel = isInterface ? 'interface' : isTypeAlias ? 'type' : isClass ? 'class' : 'type'
  const kindColor = isInterface
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'
    : isClass
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400'

  const members = isInterface || isClass ? groupMembers(node) : null
  const properties = members ? [...members.properties, ...members.accessors] : []

  return (
    <div className="pt-8 pb-4 first:pt-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      <div className="flex flex-wrap items-start gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <span className={`api-kind px-2 py-0.5 font-medium rounded-sm ${kindColor} shrink-0`}>{kindLabel}</span>
        <Symbol className="api-symbol min-w-0 flex-auto text-slate-900 dark:text-white">
          <HighlightMatch text={node.name} query={searchQuery} />
        </Symbol>
      </div>

      {description && <DescriptionMarkdown text={description} className="mt-2 text-sm text-slate-600 dark:text-slate-400" />}

      {/* For type aliases, show the type definition */}
      {isTypeAlias && node.type && (
        <div className="mt-3">
          <code className="api-type text-slate-700 dark:text-slate-300" {...TYPE_EXPRESSION_ATTRIBUTES}>
            type {node.name} = <TypeLink type={node.type} />
          </code>
        </div>
      )}

      {/* why: a constructor with a signature TypeDoc kept is one a consumer calls, so it is listed first, the way a reader meets the class */}
      {members && members.constructors.length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Constructor</Sub>
          <div className="space-y-2">
            {members.constructors.map((constructor) => (
              <ConstructorEntry key={constructor.id} parent={node} node={constructor} level={level} />
            ))}
          </div>
        </div>
      )}

      {/* why: an accessor reads like a property to a consumer, so the two share one list in declaration order */}
      {properties.length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Properties</Sub>
          <div className="space-y-2">
            {properties
              .sort((a, b) => (a.sources?.[0]?.line ?? 0) - (b.sources?.[0]?.line ?? 0))
              .map((member) =>
                member.kind === ReflectionKind.Accessor ? (
                  <AccessorEntry key={member.id} parent={node} node={member} />
                ) : (
                  <PropertyEntry key={member.id} parent={node} node={member} />
                )
              )}
          </div>
        </div>
      )}

      {members && members.methods.length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Methods</Sub>
          <div className="space-y-3">
            {members.methods.map((method) => (
              <MethodEntry key={method.id} parent={node} node={method} level={level} />
            ))}
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {examples.length === 1 ? 'Example' : 'Examples'}
          </Sub>
          {examples.map((example, index) => (
            <ExampleBlock key={index} code={example.code} label={example.label} />
          ))}
        </div>
      )}

      {/* Source link if available */}
      {node.sources?.[0]?.url && (
        <div className="mt-3">
          <a
            href={node.sources[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
          >
            View source →
          </a>
        </div>
      )}
    </div>
  )
}
