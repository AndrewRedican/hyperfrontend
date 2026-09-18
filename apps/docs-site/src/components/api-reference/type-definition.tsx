'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { TypeSegment } from './type-utils'
import type { TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { useTypeLinkResolver } from './api-link-context'
import { DescriptionMarkdown } from './description-markdown'
import { headingTag } from './heading-level'
import { HighlightMatch } from './highlight-match'
import { TYPE_EXPRESSION_ATTRIBUTES, TypeLink, TypeSegmentsText } from './type-link'
import { renderTypeSegments, getDescription } from './type-utils'
import { ReflectionKind } from './types'

interface TypeDefinitionProps {
  node: TypeDocNode
  searchQuery?: string
  /** Heading level of the symbol's own heading, one under the section it is listed in; defaults to `h3` */
  level?: ApiHeadingLevel
}

export function TypeDefinition({ node, searchQuery = '', level = 3 }: TypeDefinitionProps) {
  const resolve = useTypeLinkResolver()
  const Symbol = headingTag(level)
  const Sub = headingTag((level + 1) as ApiHeadingLevel | 6)
  const description = getDescription(node.comment)
  const isInterface = node.kind === ReflectionKind.Interface
  const isTypeAlias = node.kind === ReflectionKind.TypeAlias
  const isClass = node.kind === ReflectionKind.Class

  const kindLabel = isInterface ? 'interface' : isTypeAlias ? 'type' : isClass ? 'class' : 'type'
  const kindColor = isInterface
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'
    : isClass
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400'

  return (
    <div className="pt-8 pb-4 first:pt-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      <div className="flex flex-wrap items-start gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <span className={`api-kind px-2 py-0.5 font-medium rounded ${kindColor} shrink-0`}>{kindLabel}</span>
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

      {/* For interfaces and classes, show properties */}
      {(isInterface || isClass) && node.children && node.children.length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Properties</Sub>
          <div className="space-y-2">
            {node.children
              .filter((child) => child.kind === ReflectionKind.Property)
              .map((property) => {
                const propDescription = getDescription(property.comment)
                const isOptional = property.flags?.isOptional
                const isReadonly = property.flags?.isReadonly
                const propId = `api-${node.name}-prop-${property.name}`

                return (
                  <div key={property.id} id={propId} className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
                    <AnchorLink id={propId} />
                    <code className="text-slate-900 dark:text-white">
                      {isReadonly && <span className="text-slate-400">readonly </span>}
                      {property.name}
                      {isOptional && <span className="text-slate-400">?</span>}
                    </code>
                    <span className="text-slate-400">:</span>
                    <TypeLink type={property.type} />
                    {propDescription && (
                      <span className="text-slate-500 ml-2">
                        <DescriptionMarkdown text={propDescription} inline />
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* For classes, show methods */}
      {isClass && node.children && node.children.filter((c) => c.kind === ReflectionKind.Method).length > 0 && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Methods</Sub>
          <div className="space-y-2">
            {node.children
              .filter((child) => child.kind === ReflectionKind.Method)
              .map((method) => {
                const sig = method.signatures?.[0]
                if (!sig) return null

                const paramSegments: TypeSegment[] = []
                sig.parameters?.forEach((p, index) => {
                  if (index > 0) paramSegments.push({ text: ', ' })
                  paramSegments.push({ text: `${p.name}: ` }, ...renderTypeSegments(p.type, resolve))
                })
                const returnSegments = renderTypeSegments(sig.type, resolve)
                const methodDescription = getDescription(sig.comment)
                const methodId = `api-${node.name}-method-${method.name}`

                return (
                  <div key={method.id} id={methodId} className="text-sm">
                    <div className="flex items-start gap-2">
                      <AnchorLink id={methodId} />
                      <code className="api-type min-w-0 text-slate-900 dark:text-white" {...TYPE_EXPRESSION_ATTRIBUTES}>
                        {method.name}(<TypeSegmentsText segments={paramSegments} />
                        ):{' '}
                        <span className="text-emerald-600 dark:text-emerald-400">
                          <TypeSegmentsText segments={returnSegments} />
                        </span>
                      </code>
                    </div>
                    {methodDescription && <DescriptionMarkdown text={methodDescription} className="text-slate-500 ml-6 mt-1" />}
                  </div>
                )
              })}
          </div>
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
