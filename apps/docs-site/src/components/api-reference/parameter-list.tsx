'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { Parameter } from './types'
import { AnchorLink } from '../anchor-link'
import { DescriptionMarkdown } from './description-markdown'
import { headingTag } from './heading-level'
import { TypeLink } from './type-link'
import { getDescription } from './type-utils'

interface ParameterListProps {
  parameters: Parameter[]
  paramDescriptions?: Record<string, string>
  parentName?: string
  /** Heading level of the symbol the parameters belong to; the list's own heading sits one under it */
  level?: ApiHeadingLevel
}

export function ParameterList({ parameters, paramDescriptions = {}, parentName, level = 3 }: ParameterListProps) {
  if (parameters.length === 0) return null
  const Sub = headingTag((level + 1) as ApiHeadingLevel | 6)

  return (
    <div className="mt-4">
      <Sub className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Parameters</Sub>
      <div className="overflow-x-auto">
        <table className="api-table w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Type</th>
              <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Description</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((param) => {
              const description = paramDescriptions[param.name] || getDescription(param.comment)
              const isOptional = param.flags?.isOptional
              const isRest = param.flags?.isRest
              const paramId = parentName ? `api-${parentName}-param-${param.name}` : undefined

              return (
                <tr key={param.id} id={paramId} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-slate-900 dark:text-white align-top">
                    <div className="flex items-center gap-1">
                      {paramId && <AnchorLink id={paramId} />}
                      {isRest && <span className="text-primary-500">...</span>}
                      {param.name}
                      {isOptional && <span className="text-slate-400">?</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-4 align-top">
                    <TypeLink type={param.type} />
                  </td>
                  <td className="py-2 text-slate-600 dark:text-slate-400 align-top">
                    {description && <DescriptionMarkdown text={description} inline />}
                    {param.defaultValue && (
                      <span className="ml-2 text-xs text-slate-500">
                        (default: <code>{param.defaultValue}</code>)
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
