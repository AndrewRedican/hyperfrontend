import type { AnalyzeOptions } from '../../analyze'
import type { AnalysisResult } from '../../models'
import type { Command, CommandResult, GlobalOptions, OutputFormat } from '../types'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { analyzeProject } from '../../analyze'

/**
 * Options for the analyze CLI command.
 */
export interface AnalyzeCommandOptions {
  /** Target directory path to analyze */
  path?: string
  /** Output format (json, table, etc.) */
  format?: OutputFormat
  /** Analysis depth level */
  depth?: 'basic' | 'full' | 'deep'
  /** Glob patterns to include */
  include?: string[]
  /** Glob patterns to exclude */
  exclude?: string[]
}

/**
 * Format project type for display.
 *
 * @param type - The project type identifier
 * @returns Human-readable project type label
 */
function formatProjectType(type: string): string {
  const labels: Record<string, string> = {
    application: 'Application',
    library: 'Library',
    e2e: 'E2E Tests',
    tool: 'Tool',
    plugin: 'Plugin',
    unknown: 'Unknown',
  }
  return labels[type] ?? type
}

/**
 * Format workspace type for display.
 *
 * @param type - The workspace type identifier
 * @returns Human-readable workspace type label
 */
function formatWorkspaceType(type: string): string {
  const labels: Record<string, string> = {
    nx: 'NX Monorepo',
    turborepo: 'Turborepo',
    lerna: 'Lerna',
    pnpm: 'PNPM Workspace',
    npm: 'NPM Workspace',
    yarn: 'Yarn Workspace',
    rush: 'Rush',
    standalone: 'Standalone',
    unknown: 'Unknown',
  }
  return labels[type] ?? type
}

/**
 * Format analysis result as human-readable text.
 *
 * @param result - The analysis result to format
 * @returns Formatted text output
 */
function formatAnalysisText(result: AnalysisResult): string {
  const lines: string[] = []

  lines.push(`Project Analysis: ${result.name}`)
  lines.push('='.repeat(30))
  lines.push('')

  lines.push(`Type:           ${formatProjectType(result.projectType)}`)
  lines.push(`Workspace:      ${formatWorkspaceType(result.workspaceType)}`)
  lines.push('')

  if (result.frameworks.length > 0) {
    lines.push('Frameworks:')
    for (const framework of result.frameworks) {
      const version = framework.version ? ` ${framework.version}` : ''
      lines.push(`  * ${framework.name}${version} (confidence: ${framework.confidence}%)`)
      if (framework.metaFrameworks?.length) {
        for (const meta of framework.metaFrameworks) {
          lines.push(`    - ${meta}`)
        }
      }
    }
    lines.push('')
  }

  if (result.buildTools.length > 0) {
    lines.push('Build Tools:')
    for (const tool of result.buildTools) {
      const version = tool.version ? ` ${tool.version}` : ''
      lines.push(`  * ${tool.name}${version}`)
    }
    lines.push('')
  }

  if (result.testingFrameworks.length > 0) {
    lines.push('Testing:')
    for (const framework of result.testingFrameworks) {
      const version = framework.version ? ` ${framework.version}` : ''
      lines.push(`  * ${framework.name}${version}`)
    }
    lines.push('')
  }

  if (result.entryPoints.length > 0) {
    lines.push('Entry Points:')
    for (const entry of result.entryPoints.slice(0, 5)) {
      lines.push(`  * ${entry.path} (${entry.type})`)
    }
    if (result.entryPoints.length > 5) {
      lines.push(`  ... and ${result.entryPoints.length - 5} more`)
    }
    lines.push('')
  }

  if (result.configFiles.length > 0) {
    lines.push('Configurations:')
    for (const config of result.configFiles.slice(0, 8)) {
      lines.push(`  * ${config.name}`)
    }
    if (result.configFiles.length > 8) {
      lines.push(`  ... and ${result.configFiles.length - 8} more`)
    }
    lines.push('')
  }

  lines.push('Dependencies:')
  lines.push(`  Production:    ${result.dependencies.production}`)
  lines.push(`  Development:   ${result.dependencies.development}`)
  lines.push(`  Peer:          ${result.dependencies.peer}`)
  lines.push(`  Total:         ${result.dependencies.total}`)

  return lines.join('\n')
}

/**
 * Format analysis result as JSON string.
 *
 * @param result - The analysis result to format
 * @returns JSON formatted string
 */
function formatAnalysisJson(result: AnalysisResult): string {
  return stringify(result, null, 2)
}

/**
 * Format analysis result as YAML string.
 *
 * @param result - The analysis result to format
 * @returns YAML formatted string
 */
function formatAnalysisYaml(result: AnalysisResult): string {
  /**
   * Convert an object to YAML format recursively.
   *
   * @param obj - Object to convert
   * @param indent - Current indentation level
   * @returns YAML string representation
   */
  function toYaml(obj: unknown, indent = 0): string {
    const prefix = '  '.repeat(indent)
    if (obj === null || obj === undefined) {
      return 'null'
    }
    if (typeof obj === 'string') {
      return obj.includes('\n') || obj.includes(':') ? `"${obj}"` : obj
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj)
    }
    if (obj instanceof Date) {
      return obj.toISOString()
    }
    if (isArray(obj)) {
      if (obj.length === 0) return '[]'
      return obj.map((item) => `${prefix}- ${toYaml(item, indent + 1).trimStart()}`).join('\n')
    }
    if (typeof obj === 'object') {
      const objEntries = entries(<Record<string, unknown>>obj)
      if (objEntries.length === 0) return '{}'
      return objEntries
        .map(([key, value]) => {
          const valueStr = toYaml(value, indent + 1)
          if (typeof value === 'object' && value !== null && !isArray(value)) {
            return `${prefix}${key}:\n${valueStr}`
          }
          if (isArray(value) && value.length > 0) {
            return `${prefix}${key}:\n${valueStr}`
          }
          return `${prefix}${key}: ${valueStr}`
        })
        .join('\n')
    }
    return String(obj)
  }
  return toYaml(result)
}

/**
 * Parse analyze command arguments.
 *
 * @param args - Raw command line arguments
 * @returns Parsed analyze command options
 */
function parseAnalyzeArgs(args: string[]): AnalyzeCommandOptions {
  const { values, positionals } = parseArgs({
    args,
    options: {
      format: { type: 'string', short: 'f', default: 'text' },
      depth: { type: 'string', short: 'd', default: 'full' },
      include: { type: 'string', short: 'i' },
      exclude: { type: 'string', short: 'e' },
    },
    allowPositionals: true,
    strict: false,
  })

  const format = <OutputFormat>values.format
  const depth = <'basic' | 'full' | 'deep'>values.depth
  const includeStr = <string | undefined>values.include
  const excludeStr = <string | undefined>values.exclude

  return {
    path: positionals[0],
    format,
    depth,
    include: includeStr ? includeStr.split(',').map((s) => s.trim()) : undefined,
    exclude: excludeStr ? excludeStr.split(',').map((s) => s.trim()) : undefined,
  }
}

/**
 * Execute analyze command with given options.
 *
 * @param options - Configuration for the analyze operation
 * @returns Command execution result with exit code and output
 *
 * @example Basic analysis of current directory
 * ```typescript
 * const result = analyzeCommand({ depth: 'basic' })
 * if (result.exitCode === 0) {
 *   console.log(result.output)
 *   // => "Project Type: Library\nWorkspace: NX Monorepo\n..."
 * }
 * ```
 *
 * @example JSON output with filters
 * ```typescript
 * const result = analyzeCommand({
 *   path: './apps/frontend',
 *   format: 'json',
 *   depth: 'deep',
 *   exclude: ['node_modules', 'dist'],
 * })
 * // => { exitCode: 0, output: '{"type":"application",...}' }
 * ```
 */
export function analyzeCommand(options: AnalyzeCommandOptions): CommandResult {
  const projectPath = options.path ? resolve(options.path) : process.cwd()

  try {
    const analyzeOpts: AnalyzeOptions = {
      depth: options.depth,
    }
    if (options.include) {
      analyzeOpts.include = <AnalyzeOptions['include']>options.include
    }
    if (options.exclude) {
      analyzeOpts.exclude = <AnalyzeOptions['exclude']>options.exclude
    }
    const result = analyzeProject(projectPath, analyzeOpts)

    let output: string
    switch (options.format) {
      case 'json':
        output = formatAnalysisJson(result)
        break
      case 'yaml':
        output = formatAnalysisYaml(result)
        break
      default:
        output = formatAnalysisText(result)
    }

    return { exitCode: 0, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { exitCode: 1, error: `Analysis failed: ${message}` }
  }
}

/**
 * Analyze command definition implementing Command interface.
 */
export const analyzeCommandDef: Command = {
  name: 'analyze',
  description: 'Analyze project structure and tech stack',

  execute(args: string[], globalOptions: GlobalOptions): CommandResult {
    const options = parseAnalyzeArgs(args)

    if (globalOptions.json) {
      options.format = 'json'
    }

    return analyzeCommand(options)
  },

  getHelp(): string {
    return `
project-scope analyze [path] [options]

Analyze project structure and tech stack.

Arguments:
  path              Project path (default: current directory)

Options:
  --format, -f      Output format: text, json, yaml (default: text)
  --depth, -d       Analysis depth: basic, full, deep (default: full)
  --include, -i     Include specific analyses (comma-separated)
  --exclude, -e     Exclude specific analyses (comma-separated)

Analysis Types (for --include/--exclude):
  frameworks        Detect frameworks (React, Vue, Angular, etc.)
  buildTools        Detect build tools (Vite, Webpack, etc.)
  testing           Detect testing frameworks
  entryPoints       Discover entry points
  configs           List configuration files
  dependencies      Analyze dependencies

Examples:
  project-scope analyze
  project-scope analyze ./my-project --format json
  project-scope analyze --include frameworks,buildTools
  project-scope analyze --exclude dependencies --depth basic
`.trim()
  },
}
