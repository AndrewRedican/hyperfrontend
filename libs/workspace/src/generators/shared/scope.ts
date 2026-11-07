/**
 * The spellings a generator derives from a package name: its scope, its name without the scope,
 * the name a scope and a name make together, and the global a browser bundle registers under.
 *
 * @module generators/shared/scope
 */

import { names } from './names'

/**
 * The scope of a package name.
 *
 * @param packageName - A package name, scoped or not
 * @returns The scope with its `@`, or undefined for an unscoped name
 *
 * @example Scoped and unscoped names
 * ```typescript
 * scopeOf('@acme/core') // => '@acme'
 * scopeOf('lodash') // => undefined
 * ```
 */
export function scopeOf(packageName: string): string | undefined {
  const slash = packageName.indexOf('/')
  return packageName.startsWith('@') && slash > 0 ? packageName.slice(0, slash) : undefined
}

/**
 * A package name without its scope.
 *
 * @param packageName - A package name, scoped or not
 * @returns The part after the scope's slash, or the name as given
 *
 * @example The name a directory takes
 * ```typescript
 * unscopedName('@acme/core') // => 'core'
 * unscopedName('lodash') // => 'lodash'
 * ```
 */
export function unscopedName(packageName: string): string {
  const scope = scopeOf(packageName)
  return scope === undefined ? packageName : packageName.slice(scope.length + 1)
}

/**
 * The package name a scope and a name make.
 *
 * @param scope - The scope with its `@`, or undefined for no scope
 * @param name - The name under the scope
 * @returns `@scope/name`, or the name alone
 *
 * @example Renaming a package under its current scope
 * ```typescript
 * scopedName(scopeOf('@acme/core'), 'kernel') // => '@acme/kernel'
 * scopedName(undefined, 'kernel') // => 'kernel'
 * ```
 */
export function scopedName(scope: string | undefined, name: string): string {
  return scope === undefined ? name : `${scope}/${name}`
}

/**
 * The global a browser bundle of a package registers under: the scope and the name as one
 * class name, `@scope/my-lib` giving `ScopeMyLib`.
 *
 * @param packageName - A package name, scoped or not
 * @returns The identifier a browser attaches the bundle under
 *
 * @example The scope becomes part of the global
 * ```typescript
 * globalNameOf('@acme/data-utils') // => 'AcmeDataUtils'
 * globalNameOf('data-utils') // => 'DataUtils'
 * ```
 */
export function globalNameOf(packageName: string): string {
  const scope = scopeOf(packageName)
  return names(scope === undefined ? packageName : `${scope.slice(1)}-${unscopedName(packageName)}`).className
}
