'use client'

import type { TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { DescriptionMarkdown } from './description-markdown'
import { HighlightMatch } from './highlight-match'
import { TypeLink } from './type-link'
import { renderType, getDescription } from './type-utils'
import { ReflectionKind } from './types'

interface TypeDefinitionProps {
  node: TypeDocNode
  searchQuery?: string
}

export function TypeDefinition({ node, searchQuery = '' }: TypeDefinitionProps) {
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
    <div className="py-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      <div className="flex items-start gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${kindColor} shrink-0`}>{kindLabel}</span>
        <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white flex-1">
          <HighlightMatch text={node.name} query={searchQuery} />
        </h3>
      </div>

      {description && <DescriptionMarkdown text={description} className="mt-2 text-sm text-slate-600 dark:text-slate-400" />}

      {/* For type aliases, show the type definition */}
      {isTypeAlias && node.type && (
        <div className="mt-3">
          <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
            type {node.name} = <TypeLink type={node.type} />
          </code>
        </div>
      )}

      {/* For interfaces and classes, show properties */}
      {(isInterface || isClass) && node.children && node.children.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Properties</h4>
          <div className="space-y-2">
            {node.children
              .filter((child) => child.kind === ReflectionKind.Property)
              .map((property) => {
                const propDescription = getDescription(property.comment)
                const isOptional = property.flags?.isOptional
                const isReadonly = property.flags?.isReadonly
                const propId = `api-${node.name}-prop-${property.name}`

                return (
                  <div key={property.id} id={propId} className="flex items-start gap-2 text-sm group/prop">
                    <AnchorLink id={propId} className="opacity-0 group-hover/prop:opacity-100" />
                    <code className="font-mono text-slate-900 dark:text-white">
                      {isReadonly && <span className="text-slate-400">readonly </span>}
                      {property.name}
                      {isOptional && <span className="text-slate-400">?</span>}
                    </code>
                    <span className="text-slate-400">:</span>
                    <TypeLink type={property.type} />
                    {propDescription && (
                      <span className="text-slate-500 ml-2">
                        — <DescriptionMarkdown text={propDescription} className="inline" />
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
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Methods</h4>
          <div className="space-y-2">
            {node.children
              .filter((child) => child.kind === ReflectionKind.Method)
              .map((method) => {
                const sig = method.signatures?.[0]
                if (!sig) return null

                const params = sig.parameters?.map((p) => `${p.name}: ${renderType(p.type)}`).join(', ') || ''
                const returnType = renderType(sig.type)
                const methodDescription = getDescription(sig.comment)
                const methodId = `api-${node.name}-method-${method.name}`

                return (
                  <div key={method.id} id={methodId} className="text-sm group/method">
                    <div className="flex items-start gap-2">
                      <AnchorLink id={methodId} className="opacity-0 group-hover/method:opacity-100" />
                      <code className="font-mono text-slate-900 dark:text-white">
                        {method.name}({params}): <span className="text-emerald-600 dark:text-emerald-400">{returnType}</span>
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
