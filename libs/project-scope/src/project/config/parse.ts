import type { ConfigType } from './patterns'
import { basename } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse as parseJson } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { parseInt as safeParseInt, parseFloat as safeParseFloat } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createConfigError } from '../../core/errors/structured-errors'
import { readFileContent, readFileIfExists } from '../../core/fs'
import { matchGlobPattern } from '../../core/patterns/glob'
import { CONFIG_PATTERNS } from './patterns'

/**
 * Result of parsing a configuration file.
 */
export interface ParsedConfig {
  /** Config type */
  type: ConfigType | 'unknown'
  /** Source file path */
  path: string
  /** File format */
  format: string
  /** Parsed data (for JSON/YAML formats) */
  data?: Record<string, unknown>
  /** Raw content (for text formats or JS/TS configs) */
  raw?: string
  /** Extended config paths (if any) */
  extends?: string[]
}

/**
 * Detect config type from file name.
 * Uses safe character-by-character matching to prevent ReDoS attacks.
 *
 * @param filePath - Path to config file
 * @returns Detected config type or undefined
 */
function detectConfigType(filePath: string): ConfigType | undefined {
  const fileName = basename(filePath)

  for (const [type, info] of entries(CONFIG_PATTERNS)) {
    for (const pattern of info.patterns) {
      if (matchGlobPattern(fileName, pattern)) {
        return <ConfigType>type
      }
    }
  }

  return undefined
}

/**
 * Detect format from file path.
 *
 * @param filePath - Path to config file
 * @returns Detected format
 */
function detectFormat(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'json':
      return 'json'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'js':
    case 'cjs':
    case 'mjs':
      return 'js'
    case 'ts':
      return 'ts'
    case 'toml':
      return 'toml'
    case 'ini':
      return 'ini'
    default:
      return 'text'
  }
}

/**
 * Strip JSON comments (// and /* *\/).
 *
 * @param content - JSONC content
 * @returns JSON content without comments
 */
function stripJsonComments(content: string): string {
  let result = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false
  let stringChar = ''

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        result += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inString) {
      result += char
      if (char === stringChar && content[i - 1] !== '\\') {
        inString = false
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringChar = char
      result += char
      continue
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true
      i++
      continue
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      i++
      continue
    }

    result += char
  }

  return result
}

/**
 * Parse simple YAML key-value pairs into an object.
 * Note: This is a simplified parser for basic config structures.
 *
 * @param content - Raw YAML file content to parse
 * @returns Object representation of the YAML key-value pairs
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const lines = content.split('\n')
  const result: Record<string, unknown> = {}

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.includes(':')) {
      continue
    }

    const colonIndex = line.indexOf(':')
    const key = line.substring(0, colonIndex).trim()
    const value = line.substring(colonIndex + 1).trim()

    if (key && value) {
      if (value === 'true') {
        result[key] = true
      } else if (value === 'false') {
        result[key] = false
      } else if (value === 'null') {
        result[key] = null
      } else if (/^-?\d+$/.test(value)) {
        result[key] = safeParseInt(value, 10)
      } else if (/^-?\d+\.\d+$/.test(value)) {
        result[key] = safeParseFloat(value)
      } else {
        result[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  }

  return result
}

/**
 * Parse INI-style configuration format into an object.
 * Supports sections and key-value pairs.
 *
 * @param content - Raw INI file content to parse
 * @returns Object with sections as keys and their key-value pairs
 */
function parseIniConfig(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentSection = ''

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      result[currentSection] = {}
      continue
    }

    const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/)
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim()
      const value = keyValueMatch[2].trim()

      if (currentSection) {
        ;(<Record<string, unknown>>result[currentSection])[key] = value
      } else {
        result[key] = value
      }
    }
  }

  return result
}

/**
 * Parse dotenv-style environment variable format.
 * Handles quoted values and comments.
 *
 * @param content - Raw dotenv file content to parse
 * @returns Object mapping variable names to their values
 */
function parseDotenv(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      result[key] = value
    }
  }

  return result
}

/**
 * Parse JSON configuration file.
 *
 * @param filePath - Path to the JSON configuration file
 * @param content - Raw file content to parse
 * @param type - Category of configuration (e.g., typescript, eslint)
 * @param format - Whether to strip comments (jsonc) or parse strictly (json)
 * @returns Configuration object with parsed data and extends references
 *
 * @example Parsing JSON configuration
 * ```typescript
 * import { parseJsonConfig } from '@hyperfrontend/project-scope'
 *
 * const config = parseJsonConfig(
 *   'tsconfig.json',
 *   '{ "extends": "./base.json", "compilerOptions": {} }',
 *   'typescript'
 * )
 * // => { type: 'typescript', path: 'tsconfig.json', data: {...}, extends: ['./base.json'] }
 * ```
 */
export function parseJsonConfig(filePath: string, content: string, type?: ConfigType, format: 'json' | 'jsonc' = 'json'): ParsedConfig {
  const cleanContent = format === 'jsonc' ? stripJsonComments(content) : content

  try {
    const data = <Record<string, unknown>>parseJson(cleanContent)

    let extendsPath: string[] | undefined
    if (typeof data['extends'] === 'string') {
      extendsPath = [data['extends']]
    } else if (isArray(data['extends'])) {
      extendsPath = <string[]>data['extends']
    }

    return {
      type: type ?? 'unknown',
      path: filePath,
      format,
      data,
      extends: extendsPath,
    }
  } catch (error) {
    throw createConfigError(`Failed to parse JSON config: ${filePath}`, 'CONFIG_PARSE_ERROR', {
      filePath,
      format,
      cause: error,
    })
  }
}

/**
 * Parse YAML configuration file.
 *
 * @param filePath - Path to the YAML configuration file
 * @param content - Raw file content to parse
 * @param type - Category of configuration (e.g., github-actions, docker-compose)
 * @returns Configuration object with parsed YAML data
 *
 * @example Parsing YAML configuration
 * ```typescript
 * import { parseYamlConfig } from '@hyperfrontend/project-scope'
 *
 * const config = parseYamlConfig('.github/workflows/ci.yml', yamlContent, 'github-actions')
 * // => { type: 'github-actions', path: '...', format: 'yaml', data: {...} }
 * ```
 */
export function parseYamlConfig(filePath: string, content: string, type?: ConfigType): ParsedConfig {
  const data = parseSimpleYaml(content)

  return {
    type: type ?? 'unknown',
    path: filePath,
    format: 'yaml',
    data,
  }
}

/**
 * Parse configuration file.
 *
 * @param filePath - Path to config file
 * @param type - Optional config type (auto-detected if not provided)
 * @returns Parsed configuration
 *
 * @example Parsing a configuration file
 * ```typescript
 * import { parseConfig } from '@hyperfrontend/project-scope'
 *
 * const tsConfig = parseConfig('/project/tsconfig.json')
 * const eslintConfig = parseConfig('/project/.eslintrc.yml', 'eslint')
 * ```
 */
export function parseConfig(filePath: string, type?: ConfigType): ParsedConfig {
  const content = readFileContent(filePath)
  const detectedType = type ?? detectConfigType(filePath)
  const info = detectedType ? CONFIG_PATTERNS[detectedType] : null
  const format = info?.format ?? detectFormat(filePath)

  switch (format) {
    case 'json':
      return parseJsonConfig(filePath, content, detectedType, 'json')

    case 'jsonc':
      return parseJsonConfig(filePath, content, detectedType, 'jsonc')

    case 'yaml':
      return parseYamlConfig(filePath, content, detectedType)

    case 'ini':
      return {
        type: detectedType ?? 'unknown',
        path: filePath,
        format: 'ini',
        data: parseIniConfig(content),
      }

    case 'dotenv':
      return {
        type: detectedType ?? 'unknown',
        path: filePath,
        format: 'dotenv',
        data: parseDotenv(content),
      }

    case 'js':
    case 'ts':
      return {
        type: detectedType ?? 'unknown',
        path: filePath,
        format,
        raw: content,
      }

    default:
      return {
        type: detectedType ?? 'unknown',
        path: filePath,
        format: 'text',
        raw: content,
      }
  }
}

/**
 * Read and parse config file if it exists.
 *
 * @param configPath - Path to config file
 * @returns Parsed config or null if file doesn't exist
 *
 * @example Reading config if it exists
 * ```typescript
 * import { readConfigIfExists } from '@hyperfrontend/project-scope'
 *
 * const config = readConfigIfExists<{ strict: boolean }>('/project/tsconfig.json')
 * if (config?.strict) {
 *   console.log('Strict mode enabled')
 * }
 * ```
 */
export function readConfigIfExists<T = unknown>(configPath: string): T | null {
  const content = readFileIfExists(configPath)
  if (!content) return null

  try {
    const format = detectFormat(configPath)

    switch (format) {
      case 'json':
        return <T>parseJson(content)

      case 'jsonc':
        return <T>parseJson(stripJsonComments(content))

      case 'yaml':
        return <T>parseSimpleYaml(content)

      default:
        return null
    }
  } catch {
    return null
  }
}
