/**
 * The workspace's own rule families, `workspace/` and `projects/`: every module under
 * `src/rules/<family>/` is a rule named by its file, imported the first time a configuration
 * turns it on.
 *
 * @module config/families
 */

import type { RuleFamily, RuleModuleExports } from '@hyperfrontend/linter'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Where the families' rule modules live. */
const RULES = join(import.meta.dirname, '..', 'src', 'rules')

/**
 * One family: a loader for each rule module in its directory.
 *
 * @param name - The family's directory, which is also its prefix
 * @returns The family's rules by name
 */
function family(name: string): RuleFamily {
  const directory = join(RULES, name)
  return fromEntries(
    readdirSync(directory)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .map((file) => [
        file.slice(0, -3),
        async (): Promise<RuleModuleExports> => (await import(pathToFileURL(join(directory, file)).href)) as RuleModuleExports,
      ])
  )
}

/** The workspace's families by prefix. */
export const WORKSPACE_FAMILIES: Readonly<Record<string, RuleFamily>> = { workspace: family('workspace'), projects: family('projects') }
