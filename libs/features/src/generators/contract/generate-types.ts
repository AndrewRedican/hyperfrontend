import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Renders a JSON value as a literal TypeScript type, preserving every literal.
 *
 * A plain JSON `import` widens `'setTimezone'` to `string`; this keeps the
 * literal so the contract's action `type` unions survive.
 *
 * @param value - The JSON value to render.
 * @param indent - The current indentation prefix.
 * @returns The value rendered as a TypeScript type literal.
 */
function toTypeLiteral(value: unknown, indent: string): string {
  if (value === null) {
    return 'null'
  }
  if (isArray(value)) {
    if (value.length === 0) {
      return 'readonly []'
    }
    const inner = `${indent}  `
    return `readonly [\n${value.map((item) => `${inner}${toTypeLiteral(item, inner)}`).join(',\n')}\n${indent}]`
  }
  if (typeof value === 'object') {
    const props = entries(<Record<string, unknown>>value)
    if (props.length === 0) {
      return 'Record<string, never>'
    }
    const inner = `${indent}  `
    const body = props.map(([key, val]) => `${inner}readonly ${stringify(key)}: ${toTypeLiteral(val, inner)}`).join('\n')
    return `{\n${body}\n${indent}}`
  }
  return stringify(value)
}

/**
 * Derives the declaration-file path for a JSON contract (`*.json` → `*.d.ts`).
 *
 * @param contractPath - The config's contract path.
 * @returns The sibling `.d.ts` path the declarations are staged into.
 */
function toDeclarationPath(contractPath: string): string {
  return contractPath.replace(/\.json$/, '.d.ts')
}

/**
 * Stages a `.d.ts` of literal-type declarations beside a JSON contract.
 *
 * Only `.json` contracts need this bridge; `.ts as const` contracts derive types
 * via `typeof` and are skipped (no file is staged). Pure: stages only into `tree`.
 *
 * @param config - The resolved feature config naming the feature and contract path.
 * @param contract - The validated contract whose literals are preserved.
 * @param tree - The VFS tree the declaration file is staged into.
 *
 * @example Bridging a JSON contract to literal types
 * ```typescript
 * generateContractTypes({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }, contract, tree)
 * ```
 */
export function generateContractTypes(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  if (!config.contract.endsWith('.json')) {
    return
  }
  const shape = { name: config.name, version: config.version, emitted: contract.emitted, accepted: contract.accepted }
  const declaration = `/**
 * Generated literal-type declarations for the ${config.name} contract.
 *
 * Preserves the literal action \`type\` unions a JSON import would widen to \`string\`.
 */
declare const contract: ${toTypeLiteral(shape, '')}

export default contract
`
  tree.write(toDeclarationPath(config.contract), declaration)
}
