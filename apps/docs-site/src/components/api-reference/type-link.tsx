import type { TypeRef } from './types'
import { renderType } from './type-utils'

interface TypeLinkProps {
  type: TypeRef | undefined
}

// Renders a type reference as text (could be enhanced to link to type definitions)
export function TypeLink({ type }: TypeLinkProps) {
  const typeString = renderType(type)

  return <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">{typeString}</code>
}
