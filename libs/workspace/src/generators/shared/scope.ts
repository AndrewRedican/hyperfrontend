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
 */
export function globalNameOf(packageName: string): string {
  const scope = scopeOf(packageName)
  return names(scope === undefined ? packageName : `${scope.slice(1)}-${unscopedName(packageName)}`).className
}
