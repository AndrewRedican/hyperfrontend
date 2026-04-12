'use client'

import type { TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { DescriptionMarkdown } from './description-markdown'
import { ExampleBlock } from './example-block'
import { HighlightMatch } from './highlight-match'
import { ParameterList } from './parameter-list'
import { TypeLink } from './type-link'
import { renderType, getDescription, getReturnsDescription, getExamples, getParamDescriptions } from './type-utils'

interface FunctionSignatureProps {
  node: TypeDocNode
  searchQuery?: string
}

export function FunctionSignature({ node, searchQuery = '' }: FunctionSignatureProps) {
  const signature = node.signatures?.[0]
  if (!signature) return null

  const description = getDescription(signature.comment)
  const returnsDescription = getReturnsDescription(signature.comment)
  const examples = getExamples(signature.comment)
  const paramDescriptions = getParamDescriptions(signature.comment)

  const typeParams = signature.typeParameters?.map((tp) => tp.name).join(', ')
  const params = signature.parameters?.map((p) => {
    const optional = p.flags?.isOptional ? '?' : ''
    const rest = p.flags?.isRest ? '...' : ''
    return `${rest}${p.name}${optional}: ${renderType(p.type)}`
  })
  const returnType = renderType(signature.type)

  const signatureString = `${typeParams ? `<${typeParams}>` : ''}(${params?.join(', ') || ''}): ${returnType}`

  return (
    <div className="py-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      <div className="flex items-start gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 shrink-0">
          function
        </span>
        <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white break-all flex-1">
          <HighlightMatch text={node.name} query={searchQuery} />
          {signatureString}
        </h3>
      </div>

      {description && <DescriptionMarkdown text={description} className="mt-2 text-sm text-slate-600 dark:text-slate-400" />}

      {signature.parameters && signature.parameters.length > 0 && (
        <ParameterList parameters={signature.parameters} paramDescriptions={paramDescriptions} parentName={node.name} />
      )}

      {returnsDescription && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Returns</h4>
          <div className="flex items-start gap-2">
            <TypeLink type={signature.type} />
            <DescriptionMarkdown text={returnsDescription} className="text-sm text-slate-600 dark:text-slate-400" />
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {examples.length === 1 ? 'Example' : 'Examples'}
          </h4>
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
