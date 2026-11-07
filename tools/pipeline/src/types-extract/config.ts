/**
 * What a type extraction is told: where upstream sources are read from, which declarations are
 * wanted at what depth, how references past the boundary are written, and where the generated
 * files go.
 *
 * @module types-extract/config
 */

import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** A repository on GitHub whose files at one commit are the source of declarations. */
export interface SourceConfig {
  /** The repository, as `owner/name`. */
  readonly repo: string
  /** The tag, branch or commit the declarations are read at. */
  readonly ref: string
  /** Directory prefixes, each with a trailing slash, within which imports are followed; a module outside them is a boundary. */
  readonly include: readonly string[]
  /** The repository's license file, copied into the notice; `LICENSE` when omitted. */
  readonly license?: string
}

/** One set of root declarations and the file they are written to. */
export interface RequestConfig {
  /** The source the root module belongs to. */
  readonly source: string
  /** The module exporting the roots, as a path within the repository. */
  readonly root: string
  /** The exported names wanted in full. */
  readonly symbols: readonly string[]
  /** How many references deep declarations are followed; a root is depth 0 and the limit is inclusive. */
  readonly depth: number
  /** The generated file, workspace-relative. */
  readonly output: string
}

/** How a reference the extraction cannot or will not carry is written. */
export interface BoundaryConfig {
  /** The type written in place of a reference past the boundary. */
  readonly default: string
  /** Declarations never carried, by name, each with the type written in their place. */
  readonly overrides: Readonly<Record<string, string>>
}

/** What the provenance header of every generated file says. */
export interface HeaderConfig {
  /** The tool's name. */
  readonly tool: string
  /** The command that regenerates the files. */
  readonly regenerate: string
  /** The command that verifies the files are current. */
  readonly check: string
}

/** The configuration of one extraction. */
export interface TypesExtractConfig {
  /** The lock file, workspace-relative, holding each source's resolved commit. */
  readonly lockFile: string
  /** The sources, by name. */
  readonly sources: Readonly<Record<string, SourceConfig>>
  /** The declarations wanted, in the order their outputs are placed. */
  readonly requests: readonly RequestConfig[]
  /** How references past the boundary are written. */
  readonly boundary: BoundaryConfig
  /** The provenance header. */
  readonly header: HeaderConfig
  /** The generated barrel re-exporting every emitted declaration, workspace-relative. */
  readonly index: string
  /** The module name the barrel's header carries. */
  readonly indexModule: string
  /** The generated report of every substitution, workspace-relative. */
  readonly report: string
  /** The generated notice carrying the upstream license and the files copied, workspace-relative. */
  readonly notice: string
}

/**
 * The problems a configuration has, as sentences; an empty list means the extraction can run.
 *
 * @param config - The configuration
 * @returns The problems, in the order found
 */
export function validateConfig(config: TypesExtractConfig): string[] {
  const problems: string[] = []
  if (entries(config.sources).length === 0) problems.push('no sources are configured')
  for (const [name, source] of entries(config.sources)) {
    if (!/^[^/\s]+\/[^/\s]+$/.test(source.repo)) problems.push(`source ${name}: repo must be owner/name, not ${source.repo}`)
    if (source.ref === '') problems.push(`source ${name}: ref is empty`)
    if (source.include.length === 0) problems.push(`source ${name}: include lists no directory`)
    for (const prefix of source.include) {
      if (!prefix.endsWith('/')) problems.push(`source ${name}: include prefix ${prefix} must end with a slash`)
    }
  }
  const outputs = createSet<string>()
  for (const request of config.requests) {
    const label = `request for ${request.output}`
    if (!(request.source in config.sources)) problems.push(`${label}: unknown source ${request.source}`)
    if (request.symbols.length === 0) problems.push(`${label}: no symbols`)
    if (!(request.depth >= 0 && request.depth % 1 === 0)) problems.push(`${label}: depth must be a whole number, not ${request.depth}`)
    if (outputs.has(request.output)) problems.push(`${label}: output is written by an earlier request`)
    outputs.add(request.output)
  }
  if (config.requests.length === 0) problems.push('no requests are configured')
  return problems
}
