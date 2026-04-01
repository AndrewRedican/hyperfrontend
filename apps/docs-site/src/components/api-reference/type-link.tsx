import type { TypeRef } from './types'
import { renderType } from './type-utils'

interface TypeLinkProps {
  type: TypeRef | undefined
}

export function TypeLink({ type }: TypeLinkProps) {
  const typeString = renderType(type)

  return <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">{typeString}</code>
}
