'use client'

import type { TypeDocNode } from './types'
import { ReflectionKind } from './types'
import { renderType, getDescription } from './type-utils'
import { TypeLink } from './type-link'
import { CopyButton } from './copy-button'

interface TypeDefinitionProps {
  node: TypeDocNode
}

// Renders an interface or type alias definition
export function TypeDefinition({ node }: TypeDefinitionProps) {
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

  // Generate a copyable type definition string
  const getCopyableDefinition = () => {
    if (isTypeAlias && node.type) {
      return `type ${node.name} = ${renderType(node.type)}`
    }
    if (isInterface || isClass) {
      const props = node.children
        ?.filter((child) => child.kind === ReflectionKind.Property)
        .map((p) => {
          const optional = p.flags?.isOptional ? '?' : ''
          const readonly = p.flags?.isReadonly ? 'readonly ' : ''
          return `  ${readonly}${p.name}${optional}: ${renderType(p.type)}`
        })
        .join('\n')
      return `${kindLabel} ${node.name} {\n${props || ''}\n}`
    }
    return node.name
  }

  return (
    <div className="py-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      <div className="flex items-start gap-2 group">
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${kindColor} shrink-0`}>{kindLabel}</span>
        <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white flex-1">{node.name}</h3>
        <CopyButton text={getCopyableDefinition()} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>

      {description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>}

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

                return (
                  <div key={property.id} className="flex items-start gap-2 text-sm">
                    <code className="font-mono text-slate-900 dark:text-white">
                      {isReadonly && <span className="text-slate-400">readonly </span>}
                      {property.name}
                      {isOptional && <span className="text-slate-400">?</span>}
                    </code>
                    <span className="text-slate-400">:</span>
                    <TypeLink type={property.type} />
                    {propDescription && <span className="text-slate-500 ml-2">— {propDescription}</span>}
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

                return (
                  <div key={method.id} className="text-sm">
                    <code className="font-mono text-slate-900 dark:text-white">
                      {method.name}({params}): <span className="text-emerald-600 dark:text-emerald-400">{returnType}</span>
                    </code>
                    {methodDescription && <p className="text-slate-500 ml-4 mt-1">{methodDescription}</p>}
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
