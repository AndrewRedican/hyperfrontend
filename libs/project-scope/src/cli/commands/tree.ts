import type { WalkEntry } from '../../project/traversal'
import type { Command, CommandResult, GlobalOptions, OutputFormat } from '../types'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { parseInt as safeParseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { getFileStat } from '../../core/fs'
import { walkDirectory } from '../../project/traversal'

/**
 * Configuration options for the tree command.
 */
export interface TreeCommandOptions {
  /** Root path to display tree from */
  path?: string
  /** Maximum directory depth to traverse */
  depth?: number
  /** Glob pattern to filter entries */
  pattern?: string
  /** Patterns to exclude from output */
  ignore?: string[]
  /** Show only directories */
  dirsOnly?: boolean
  /** Show only files */
  filesOnly?: boolean
  /** Display file sizes */
  showSize?: boolean
  /** Display modification dates */
  showModified?: boolean
  /** Output format (text, json, etc.) */
  format?: OutputFormat
}

/**
 * Tree node for building the tree structure.
 */
interface TreeNode {
  /** Display name of the node */
  name: string
  /** Full path to the entry */
  path: string
  /** Whether this node is a directory */
  isDirectory: boolean
  /** File size in bytes (if applicable) */
  size?: number
  /** Last modification date */
  modified?: Date
  /** Child nodes */
  children: TreeNode[]
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - File size to format
 * @returns Human-readable size string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
}

/**
 * Format date in short format.
 *
 * @param date - Date to format
 * @returns Formatted date string (MM-DD HH:mm)
 */
function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const mins = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${mins}`
}

/**
 * Build tree structure from walk entries.
 *
 * @param rootPath - Root directory path
 * @param walkEntries - Array of walk entries collected from walkDirectory
 * @param options - Tree command options for filtering
 * @returns Tree node representing the directory structure
 */
function buildTree(rootPath: string, walkEntries: WalkEntry[], options: TreeCommandOptions): TreeNode {
  const root: TreeNode = {
    name: basename(rootPath),
    path: rootPath,
    isDirectory: true,
    children: [],
  }

  const nodeMap = createMap<string, TreeNode>()
  nodeMap.set('.', root)

  const sortedEntries = [...walkEntries].sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  for (const entry of sortedEntries) {
    if (options.dirsOnly && !entry.isDirectory) continue
    if (options.filesOnly && entry.isDirectory) continue

    const node: TreeNode = {
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
      children: [],
    }

    if ((options.showSize || options.showModified) && entry.isFile) {
      const stats = getFileStat(entry.path)
      if (stats) {
        if (options.showSize) node.size = stats.size
        if (options.showModified) node.modified = stats.modified
      }
    }

    const parts = entry.relativePath.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '.'
    const parent = nodeMap.get(parentPath)

    if (parent) {
      parent.children.push(node)
    }

    nodeMap.set(entry.relativePath, node)
  }

  return root
}

/**
 * Render tree node as ASCII art recursively.
 *
 * @param node - Tree node to render
 * @param options - Tree command options
 * @param prefix - Current line prefix for indentation
 * @param isLast - Whether this is the last child in parent
 * @returns Array of lines representing the tree
 */
function renderTreeText(node: TreeNode, options: TreeCommandOptions, prefix = '', isLast = true): string[] {
  const lines: string[] = []

  const connector = isLast ? '└── ' : '├── '
  const dirMark = node.isDirectory ? '/' : ''
  let line = `${prefix}${connector}${node.name}${dirMark}`

  const meta: string[] = []
  if (options.showSize && node.size !== undefined) {
    meta.push(formatSize(node.size))
  }
  if (options.showModified && node.modified) {
    meta.push(formatDate(node.modified))
  }
  if (meta.length > 0) {
    line += `  [${meta.join(' ')}]`
  }

  lines.push(line)

  const childPrefix = prefix + (isLast ? '    ' : '│   ')
  const sortedChildren = [...node.children].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  for (let i = 0; i < sortedChildren.length; i++) {
    const child = sortedChildren[i]
    const childIsLast = i === sortedChildren.length - 1
    lines.push(...renderTreeText(child, options, childPrefix, childIsLast))
  }

  return lines
}

/**
 * Format tree as human-readable text output.
 *
 * @param rootPath - Root directory path
 * @param tree - Tree node structure
 * @param options - Tree command options
 * @returns Formatted text output with tree visualization
 */
function formatTreeText(rootPath: string, tree: TreeNode, options: TreeCommandOptions): string {
  const lines: string[] = []

  lines.push(basename(rootPath))

  let dirCount = 0
  let fileCount = 0

  /**
   * Count directories and files in tree.
   *
   * @param node - Current tree node
   */
  function countNodes(node: TreeNode): void {
    if (node.isDirectory) {
      dirCount++
    } else {
      fileCount++
    }
    for (const child of node.children) {
      countNodes(child)
    }
  }

  const sortedChildren = [...tree.children].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  for (let i = 0; i < sortedChildren.length; i++) {
    const child = sortedChildren[i]
    const isLast = i === sortedChildren.length - 1
    lines.push(...renderTreeText(child, options, '', isLast))
    countNodes(child)
  }

  lines.push('')
  const dirText = dirCount === 1 ? '1 directory' : `${dirCount} directories`
  const fileText = fileCount === 1 ? '1 file' : `${fileCount} files`
  lines.push(`${dirText}, ${fileText}`)

  return lines.join('\n')
}

/**
 * Format tree as JSON string.
 *
 * @param tree - Tree node structure
 * @returns JSON formatted string
 */
function formatTreeJson(tree: TreeNode): string {
  return stringify(tree, null, 2)
}

/**
 * Parse tree command arguments.
 *
 * @param args - Raw command line arguments
 * @returns Parsed tree command options
 */
function parseTreeArgs(args: string[]): TreeCommandOptions {
  const { values, positionals } = parseArgs({
    args,
    options: {
      depth: { type: 'string', short: 'd', default: '3' },
      pattern: { type: 'string', short: 'p' },
      ignore: { type: 'string' },
      'dirs-only': { type: 'boolean', default: false },
      'files-only': { type: 'boolean', default: false },
      size: { type: 'boolean', default: false },
      modified: { type: 'boolean', default: false },
      format: { type: 'string', short: 'f', default: 'text' },
    },
    allowPositionals: true,
    strict: false,
  })

  const depthStr = values.depth as string
  const ignoreStr = values.ignore as string | undefined

  return {
    path: positionals[0],
    depth: safeParseInt(depthStr, 10),
    pattern: values.pattern as string | undefined,
    ignore: ignoreStr ? ignoreStr.split(',').map((s) => s.trim()) : undefined,
    dirsOnly: values['dirs-only'] as boolean,
    filesOnly: values['files-only'] as boolean,
    showSize: values.size as boolean,
    showModified: values.modified as boolean,
    format: values.format as OutputFormat,
  }
}

/**
 * Execute tree command with given options.
 *
 * @param options - Configuration for the tree operation
 * @returns Command execution result with exit code and output
 *
 * @example Basic tree of current directory
 * ```typescript
 * const result = treeCommand({ depth: 2 })
 * if (result.exitCode === 0) {
 *   console.log(result.output)
 *   // => "src/\n├── index.ts\n├── lib/\n│   └── utils.ts\n..."
 * }
 * ```
 *
 * @example Directories only with metadata
 * ```typescript
 * const result = treeCommand({
 *   path: './project',
 *   dirsOnly: true,
 *   showSize: true,
 *   ignore: ['node_modules', '.git'],
 *   format: 'json',
 * })
 * // => { exitCode: 0, output: '[{"name":"src","isDirectory":true,...}]' }
 * ```
 */
export function treeCommand(options: TreeCommandOptions): CommandResult {
  const rootPath = options.path ? resolve(options.path) : process.cwd()

  try {
    const walkEntries: WalkEntry[] = []
    walkDirectory(
      rootPath,
      (entry: WalkEntry) => {
        walkEntries.push(entry)
        return undefined
      },
      {
        maxDepth: options.depth ?? 3,
        ignorePatterns: options.ignore,
        includeHidden: false,
      }
    )

    const tree = buildTree(rootPath, walkEntries, options)

    let output: string
    if (options.format === 'json') {
      output = formatTreeJson(tree)
    } else {
      output = formatTreeText(rootPath, tree, options)
    }

    return { exitCode: 0, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { exitCode: 1, error: `Tree failed: ${message}` }
  }
}

/**
 * Tree command definition implementing Command interface.
 */
export const treeCommandDef: Command = {
  name: 'tree',
  description: 'Show file tree',

  execute(args: string[], globalOptions: GlobalOptions): CommandResult {
    const options = parseTreeArgs(args)

    if (globalOptions.json) {
      options.format = 'json'
    }

    return treeCommand(options)
  },

  getHelp(): string {
    return `
project-scope tree [path] [options]

Show file tree visualization.

Arguments:
  path              Directory path (default: current directory)

Options:
  --depth, -d       Maximum depth (default: 3)
  --pattern, -p     Glob pattern to match
  --ignore          Patterns to ignore (comma-separated)
  --dirs-only       Show directories only
  --files-only      Show files only
  --size            Show file sizes
  --modified        Show modification times
  --format, -f      Output format: text, json (default: text)

Examples:
  project-scope tree
  project-scope tree src --depth 5
  project-scope tree --pattern "*.ts" --ignore "*.spec.ts"
  project-scope tree --dirs-only
  project-scope tree --size --modified
`.trim()
  },
}
