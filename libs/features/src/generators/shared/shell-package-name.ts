/**
 * Names the shell package a feature's build emits.
 *
 * The generated package manifest, the generated README and the release manifest
 * the build writes beside them all name the package through here, so the three
 * always agree.
 *
 * @param featureName - The feature's `name` as its config declares it, scope included.
 * @returns The package name a host installs the shell under.
 *
 * @example Naming the shell of a scoped feature
 * ```typescript
 * shellPackageName('@acme/clock') // => '@acme/clock-shell'
 * ```
 */
export function shellPackageName(featureName: string): string {
  return `${featureName}-shell`
}
