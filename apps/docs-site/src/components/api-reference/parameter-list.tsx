import type { Parameter } from './types'
import { TypeLink } from './type-link'

interface ParameterListProps {
  parameters: Parameter[]
  paramDescriptions?: Record<string, string>
}

export function ParameterList({ parameters, paramDescriptions = {} }: ParameterListProps) {
  if (parameters.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Parameters</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Type</th>
              <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Description</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((param) => {
              const description = paramDescriptions[param.name] || ''
              const isOptional = param.flags?.isOptional
              const isRest = param.flags?.isRest

              return (
                <tr key={param.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="py-2 pr-4 font-mono text-slate-900 dark:text-white align-top">
                    {isRest && <span className="text-primary-500">...</span>}
                    {param.name}
                    {isOptional && <span className="text-slate-400">?</span>}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    <TypeLink type={param.type} />
                  </td>
                  <td className="py-2 text-slate-600 dark:text-slate-400 align-top">
                    {description}
                    {param.defaultValue && (
                      <span className="ml-2 text-xs text-slate-500">
                        (default: <code className="font-mono">{param.defaultValue}</code>)
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
