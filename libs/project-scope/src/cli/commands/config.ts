import type { ConfigType, DetectedConfig } from '../../project/config'
import type { Command, CommandResult, GlobalOptions, OutputFormat } from '../types'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { detectConfigs, CONFIG_PATTERNS, parseConfig } from '../../project/config'

/**
 * Options for the config CLI command.
 */
export interface ConfigCommandOptions {
  /** Target directory path to scan for configs */
  path?: string
  /** Filter by specific config type */
  type?: ConfigType
  /** Include file contents in output */
  showContents?: boolean
  /** Output format (json, table, etc.) */
  format?: OutputFormat
}

/**
 * Group configurations by category.
 */
type ConfigCategory = 'TypeScript' | 'Linting' | 'Build' | 'Testing' | 'Package' | 'Monorepo' | 'Git' | 'Environment' | 'Other'

/**
 * Map config types to categories.
 */
const CONFIG_CATEGORIES: Record<ConfigType, ConfigCategory> = {
  'package.json': 'Package',
  'package-lock.json': 'Package',
  'pnpm-lock.yaml': 'Package',
  'yarn.lock': 'Package',
  '.npmrc': 'Package',
  tsconfig: 'TypeScript',
  nx: 'Monorepo',
  'project.json': 'Monorepo',
  'workspace.json': 'Monorepo',
  turbo: 'Monorepo',
  lerna: 'Monorepo',
  webpack: 'Build',
  rollup: 'Build',
  vite: 'Build',
  esbuild: 'Build',
  babel: 'Build',
  swc: 'Build',
  jest: 'Testing',
  vitest: 'Testing',
  cypress: 'Testing',
  playwright: 'Testing',
  next: 'Build',
  angular: 'Build',
  nuxt: 'Build',
  svelte: 'Build',
  astro: 'Build',
  eslint: 'Linting',
  prettier: 'Linting',
  env: 'Environment',
  '.gitignore': 'Git',
  '.gitattributes': 'Git',
}

/**
 * Get available config type names for help text.
 *
 * @returns Comma-separated list of config type names
 */
function getAvailableTypes(): string {
  return <string>keys(CONFIG_PATTERNS).join(', ')
}

/**
 * Group detected configs by category.
 *
 * @param configs - Array of detected configuration files
 * @returns Configs grouped by category
 */
function groupByCategory(configs: DetectedConfig[]): Record<ConfigCategory, DetectedConfig[]> {
  const groups: Record<ConfigCategory, DetectedConfig[]> = {
    TypeScript: [],
    Linting: [],
    Build: [],
    Testing: [],
    Package: [],
    Monorepo: [],
    Git: [],
    Environment: [],
    Other: [],
  }

  for (const config of configs) {
    const category = CONFIG_CATEGORIES[config.type] ?? 'Other'
    groups[category].push(config)
  }

  return groups
}

/**
 * Format configurations as human-readable text.
 *
 * @param configs - Array of detected configuration files
 * @param rootPath - Project root path
 * @param showContents - Whether to show file contents
 * @returns Formatted text output
 */
function formatConfigText(configs: DetectedConfig[], rootPath: string, showContents: boolean): string {
  const lines: string[] = []
  lines.push('Configuration Files')
  lines.push('===================')
  lines.push('')

  if (configs.length === 0) {
    lines.push('No configuration files found.')
    return lines.join('\n')
  }

  const grouped = groupByCategory(configs)

  for (const [category, categoryConfigs] of entries(grouped)) {
    if (categoryConfigs.length === 0) continue

    lines.push(`${category}:`)
    for (const config of categoryConfigs) {
      const description = config.info.description
      lines.push(`  * ${config.path}`)
      if (description) {
        lines.push(`    ${description}`)
      }

      if (showContents) {
        try {
          const fullPath = join(rootPath, config.path)
          const parsed = parseConfig(fullPath, config.type)

          if (parsed.data) {
            const contentStr = stringify(parsed.data, null, 2)
            const indented = contentStr
              .split('\n')
              .map((line) => `      ${line}`)
              .join('\n')
            lines.push('    Contents:')
            lines.push(indented)
          } else if (parsed.raw) {
            const preview = parsed.raw.slice(0, 500)
            const indented = preview
              .split('\n')
              .slice(0, 10)
              .map((line) => `      ${line}`)
              .join('\n')
            lines.push('    Contents (preview):')
            lines.push(indented)
            if (parsed.raw.length > 500) {
              lines.push('      ...')
            }
          }
        } catch {
          lines.push('    [Unable to read contents]')
        }
      }
    }
    lines.push('')
  }

  lines.push(`Total: ${configs.length} configuration file(s) found`)

  return lines.join('\n')
}

/**
 * Format configurations as JSON.
 *
 * @param configs - Array of detected configuration files
 * @param rootPath - Project root path
 * @param showContents - Whether to include file contents
 * @returns JSON formatted string
 */
function formatConfigJson(configs: DetectedConfig[], rootPath: string, showContents: boolean): string {
  const result = configs.map((config) => {
    const entry: Record<string, unknown> = {
      type: config.type,
      path: config.path,
      description: config.info.description,
      format: config.info.format,
      canExtend: config.info.canExtend,
    }

    if (showContents) {
      try {
        const fullPath = join(rootPath, config.path)
        const parsed = parseConfig(fullPath, config.type)
        if (parsed.data) {
          entry['contents'] = parsed.data
        } else if (parsed.raw) {
          entry['rawContents'] = parsed.raw.slice(0, 2000)
        }
        if (parsed.extends) {
          entry['extends'] = parsed.extends
        }
      } catch {
        entry['contents'] = null
        entry['error'] = 'Unable to parse'
      }
    }

    return entry
  })

  return stringify(result, null, 2)
}

/**
 * Parse config command arguments.
 *
 * @param args - Raw command line arguments
 * @returns Parsed config command options
 */
function parseConfigArgs(args: string[]): ConfigCommandOptions {
  const { values, positionals } = parseArgs({
    args,
    options: {
      type: { type: 'string', short: 't' },
      'show-contents': { type: 'boolean', default: false },
      format: { type: 'string', short: 'f', default: 'text' },
    },
    allowPositionals: true,
    strict: false,
  })

  return {
    path: positionals[0],
    type: <ConfigType | undefined>values.type,
    showContents: <boolean>values['show-contents'],
    format: <OutputFormat>values.format,
  }
}

/**
 * Execute config command with given options.
 *
 * @param options - Configuration command options
 * @returns Command execution result with exit code and output
 *
 * @example Detect all configs in a project
 * ```typescript
 * const result = configCommand({ path: './my-project' })
 * if (result.exitCode === 0) {
 *   console.log(result.output)
 *   // => "TypeScript: tsconfig.json\nLinting: eslint.config.js\n..."
 * }
 * ```
 *
 * @example Filter by type with contents
 * ```typescript
 * const result = configCommand({
 *   path: './my-project',
 *   type: 'tsconfig',
 *   showContents: true,
 *   format: 'json',
 * })
 * // => { exitCode: 0, output: '[{"type":"tsconfig","path":"tsconfig.json",...}]' }
 * ```
 */
export function configCommand(options: ConfigCommandOptions): CommandResult {
  const projectPath = options.path ? resolve(options.path) : process.cwd()

  try {
    const types = options.type ? [options.type] : undefined
    const configs = detectConfigs(projectPath, types)

    let output: string
    switch (options.format) {
      case 'json':
        output = formatConfigJson(configs, projectPath, options.showContents ?? false)
        break
      default:
        output = formatConfigText(configs, projectPath, options.showContents ?? false)
    }

    return { exitCode: 0, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { exitCode: 1, error: `Config inspection failed: ${message}` }
  }
}

/**
 * Config command definition implementing Command interface.
 */
export const configCommandDef: Command = {
  name: 'config',
  description: 'Inspect configuration files',

  execute(args: string[], globalOptions: GlobalOptions): CommandResult {
    const options = parseConfigArgs(args)

    if (globalOptions.json) {
      options.format = 'json'
    }

    return configCommand(options)
  },

  getHelp(): string {
    return `
project-scope config [path] [options]

Inspect configuration files in a project.

Arguments:
  path              Project path (default: current directory)

Options:
  --type, -t        Filter by config type (${getAvailableTypes()})
  --show-contents   Show file contents
  --format, -f      Output format: text, json (default: text)

Examples:
  project-scope config
  project-scope config --type tsconfig
  project-scope config --show-contents
  project-scope config ./my-project --format json
`.trim()
  },
}
