'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { TypeSegment } from './type-utils'
import type { TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { useTypeLinkResolver } from './api-link-context'
import { DescriptionMarkdown } from './description-markdown'
import { ExampleBlock } from './example-block'
import { headingTag } from './heading-level'
import { HighlightMatch } from './highlight-match'
import { ParameterList } from './parameter-list'
import { TypeLink, TypeSegmentsText } from './type-link'
import { renderTypeSegments, getDescription, getReturnsDescription, getExamples, getParamDescriptions } from './type-utils'

interface FunctionSignatureProps {
  node: TypeDocNode
  searchQuery?: string
  /** Heading level of the symbol's own heading, one under the section it is listed in; defaults to `h3` */
  level?: ApiHeadingLevel
}

export function FunctionSignature({ node, searchQuery = '', level = 3 }: FunctionSignatureProps) {
  const resolve = useTypeLinkResolver()
  const signature = node.signatures?.[0]
  if (!signature) return null
  const Symbol = headingTag(level)
  const Sub = headingTag((level + 1) as ApiHeadingLevel | 6)

  const description = getDescription(signature.comment)
  const returnsDescription = getReturnsDescription(signature.comment)
  const examples = getExamples(signature.comment)
  const paramDescriptions = getParamDescriptions(signature.comment)

  const typeParams = signature.typeParameters?.map((tp) => tp.name).join(', ')
  const signatureSegments: TypeSegment[] = [{ text: `${typeParams ? `<${typeParams}>` : ''}(` }]
  signature.parameters?.forEach((p, index) => {
    const optional = p.flags?.isOptional ? '?' : ''
    const rest = p.flags?.isRest ? '...' : ''
    if (index > 0) signatureSegments.push({ text: ', ' })
    signatureSegments.push({ text: `${rest}${p.name}${optional}: ` }, ...renderTypeSegments(p.type, resolve))
  })
  signatureSegments.push({ text: '): ' }, ...renderTypeSegments(signature.type, resolve))

  return (
    <div className="pt-8 pb-4 first:pt-4 border-b border-slate-200 dark:border-slate-800 last:border-0" id={`api-${node.name}`}>
      {/* why: the row folds rather than squeezes, so a signature wider than the room beside its badge drops under the badge with the whole column to fold in, and its name stays whole */}
      <div className="flex flex-wrap items-start gap-2 group">
        <AnchorLink id={`api-${node.name}`} />
        <span className="api-kind px-2 py-0.5 font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 shrink-0">
          function
        </span>
        {/* why: a signature folds at its own spaces; breaking it anywhere split identifiers across lines */}
        <Symbol className="api-symbol min-w-0 flex-auto text-slate-900 dark:text-white">
          <HighlightMatch text={node.name} query={searchQuery} />
          <TypeSegmentsText segments={signatureSegments} />
        </Symbol>
      </div>

      {description && <DescriptionMarkdown text={description} className="mt-2 text-sm text-slate-600 dark:text-slate-400" />}

      {signature.parameters && signature.parameters.length > 0 && (
        <ParameterList parameters={signature.parameters} paramDescriptions={paramDescriptions} parentName={node.name} level={level} />
      )}

      {returnsDescription && (
        <div className="mt-4">
          <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Returns</Sub>
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <TypeLink type={signature.type} />
            <DescriptionMarkdown text={returnsDescription} className="min-w-0 text-sm text-slate-600 dark:text-slate-400" />
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
