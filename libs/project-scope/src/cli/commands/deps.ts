import type { AllDependencies, DependencyMap } from '../../project/package/dependencies'
import type { Command, CommandResult, GlobalOptions, OutputFormat } from '../types'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getDependencies, readPackageJson } from '../../project/package'

export interface DepsCommandOptions {
  path?: string
  type?: 'production' | 'development' | 'peer' | 'optional' | 'all'
  format?: OutputFormat
}

/**
 * Format a dependency map as text lines.
 *
 * @param deps - Dependency map to format
 * @param maxItems - Maximum number of items to show
 * @returns Array of formatted lines
 */
function formatDependencyList(deps: DependencyMap, maxItems = 20): string[] {
  const lines: string[] = []
  const depEntries = entries(deps)

  depEntries.sort((a, b) => a[0].localeCompare(b[0]))

  const displayCount = min(depEntries.length, maxItems)
  for (let i = 0; i < displayCount; i++) {
    const [name, version] = depEntries[i]
    const paddedName = name.padEnd(30)
    lines.push(`  ${paddedName} ${version}`)
  }

  if (depEntries.length > maxItems) {
    lines.push(`  ... and ${depEntries.length - maxItems} more`)
  }

  return lines
}

/**
 * Format all dependencies as human-readable text.
 *
 * @param allDeps - All dependencies categorized
 * @param filterType - Type filter to apply
 * @returns Formatted text output
 */
function formatDepsText(allDeps: AllDependencies, filterType: DepsCommandOptions['type']): string {
  const lines: string[] = []
  lines.push('Dependencies')
  lines.push('============')
  lines.push('')

  const prodCount = keys(allDeps.dependencies).length
  const devCount = keys(allDeps.devDependencies).length
  const peerCount = keys(allDeps.peerDependencies).length
  const optCount = keys(allDeps.optionalDependencies).length
  const totalCount = prodCount + devCount + peerCount + optCount

  const showAll = !filterType || filterType === 'all'

  if (showAll || filterType === 'production') {
    lines.push(`Production (${prodCount}):`)
    if (prodCount > 0) {
      lines.push(...formatDependencyList(allDeps.dependencies))
    } else {
      lines.push('  (none)')
    }
    lines.push('')
  }

  if (showAll || filterType === 'development') {
    lines.push(`Development (${devCount}):`)
    if (devCount > 0) {
      lines.push(...formatDependencyList(allDeps.devDependencies))
    } else {
      lines.push('  (none)')
    }
    lines.push('')
  }

  if (showAll || filterType === 'peer') {
    lines.push(`Peer (${peerCount}):`)
    if (peerCount > 0) {
      lines.push(...formatDependencyList(allDeps.peerDependencies))
    } else {
      lines.push('  (none)')
    }
    lines.push('')
  }

  if (showAll || filterType === 'optional') {
    lines.push(`Optional (${optCount}):`)
    if (optCount > 0) {
      lines.push(...formatDependencyList(allDeps.optionalDependencies))
    } else {
      lines.push('  (none)')
    }
    lines.push('')
  }

  if (showAll) {
    lines.push('Summary:')
    lines.push(`  Total: ${totalCount} dependencies`)
    lines.push(`    Production:   ${prodCount}`)
    lines.push(`    Development:  ${devCount}`)
    lines.push(`    Peer:         ${peerCount}`)
    lines.push(`    Optional:     ${optCount}`)
  }

  return lines.join('\n')
}

/**
 * Format dependencies as JSON.
 *
 * @param allDeps - All dependencies categorized
 * @param filterType - Type filter to apply
 * @returns JSON formatted string
 */
function formatDepsJson(allDeps: AllDependencies, filterType: DepsCommandOptions['type']): string {
  const prodCount = keys(allDeps.dependencies).length
  const devCount = keys(allDeps.devDependencies).length
  const peerCount = keys(allDeps.peerDependencies).length
  const optCount = keys(allDeps.optionalDependencies).length

  const showAll = !filterType || filterType === 'all'

  const result: Record<string, unknown> = {}

  if (showAll || filterType === 'production') {
    result['dependencies'] = allDeps.dependencies
  }
  if (showAll || filterType === 'development') {
    result['devDependencies'] = allDeps.devDependencies
  }
  if (showAll || filterType === 'peer') {
    result['peerDependencies'] = allDeps.peerDependencies
  }
  if (showAll || filterType === 'optional') {
    result['optionalDependencies'] = allDeps.optionalDependencies
  }

  result['summary'] = {
    production: prodCount,
    development: devCount,
    peer: peerCount,
    optional: optCount,
    total: prodCount + devCount + peerCount + optCount,
  }

  return stringify(result, null, 2)
}

/**
 * Parse deps command arguments.
 *
 * @param args - Raw command line arguments
 * @returns Parsed deps command options
 */
function parseDepsArgs(args: string[]): DepsCommandOptions {
  const { values, positionals } = parseArgs({
    args,
    options: {
      type: { type: 'string', short: 't', default: 'all' },
      format: { type: 'string', short: 'f', default: 'text' },
    },
    allowPositionals: true,
    strict: false,
  })

  return {
    path: positionals[0],
    type: <DepsCommandOptions['type']>values.type,
    format: <OutputFormat>values.format,
  }
}

/**
 * Execute deps command with given options.
 *
 * @param options - Parsed command options
 * @returns Command execution result with exit code and output
 */
export function depsCommand(options: DepsCommandOptions): CommandResult {
  const projectPath = options.path ? resolve(options.path) : process.cwd()

  try {
    const packageJson = readPackageJson(projectPath)
    const allDeps = getDependencies(packageJson)

    let output: string
    switch (options.format) {
      case 'json':
        output = formatDepsJson(allDeps, options.type)
        break
      default:
        output = formatDepsText(allDeps, options.type)
    }

    return { exitCode: 0, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { exitCode: 1, error: `Dependency analysis failed: ${message}` }
  }
}

/**
 * Deps command definition implementing Command interface.
 */
export const depsCommandDef: Command = {
  name: 'deps',
  description: 'Analyze dependencies',

  execute(args: string[], globalOptions: GlobalOptions): CommandResult {
    const options = parseDepsArgs(args)

    if (globalOptions.json) {
      options.format = 'json'
    }

    return depsCommand(options)
  },

  getHelp(): string {
    return `
project-scope deps [path] [options]

Analyze project dependencies.

Arguments:
  path              Project path (default: current directory)

Options:
  --type, -t        Filter by dependency type:
                      production  - Runtime dependencies
                      development - Dev-time dependencies
                      peer        - Peer dependencies
                      optional    - Optional dependencies
                      all         - All dependencies (default)
  --format, -f      Output format: text, json (default: text)

Examples:
  project-scope deps
  project-scope deps --type production
  project-scope deps ./my-project --format json
  project-scope deps --type development
`.trim()
  },
}
