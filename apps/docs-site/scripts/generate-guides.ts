import type { GuideIndex, GuideIndexEntry, GuideMeta, GuideUnit, LibrarySource, SnippetRegion } from './generate-guides.types'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { extractMarkdownSections } from '../src/lib/slug'

// why: cwd-anchored like the src/ loaders (all entry points run from apps/docs-site), which also keeps this module importable by the vitest harness where __dirname does not exist
const WORKSPACE_ROOT = resolve(process.cwd(), '../..')
const GUIDES_SOURCE = resolve(process.cwd(), 'content/guides')
const GUIDES_SOURCE_LABEL = 'content/guides'
const OUTPUT_DIR = resolve(process.cwd(), '.generated')
const GUIDES_OUTPUT = join(OUTPUT_DIR, 'guides')
const API_OUTPUT = join(OUTPUT_DIR, 'api')
const PUBLIC_INDEX = resolve(process.cwd(), 'public/guides/index.json')
const APP_DIR = resolve(process.cwd(), 'src/app')
const GITHUB_BLOB_BASE = 'https://github.com/AndrewRedican/hyperfrontend/blob/main'

const GUIDE_TYPES = ['tutorial', 'how-to', 'troubleshooting', 'recipe']
const GUIDE_PRIORITIES = ['P0', 'P1', 'P2']
const VERIFICATION_KINDS = ['demo', 'authored']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Discovers every guide unit in the docs-site content root.
 *
 * A guide unit is a directory `apps/docs-site/content/guides/<slug>/` containing
 * a `meta.json` and a `guide.md`. A directory with only one of the pair is an
 * authoring error and fails generation. Guides are editorial artifacts of the
 * docs site: a guide names the packages it concerns in `meta.json` rather than
 * living inside any one package's source tree.
 *
 * @param errors - Accumulator for validation errors
 * @returns Discovered guide units in deterministic (slug-sorted) order
 */
function discoverGuideUnits(errors: string[]): GuideUnit[] {
  const units: GuideUnit[] = []
  if (!existsSync(GUIDES_SOURCE)) return units

  for (const entry of readdirSync(GUIDES_SOURCE, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const slug = entry.name
    const unitDir = join(GUIDES_SOURCE, slug)
    const metaPath = join(unitDir, 'meta.json')
    const guidePath = join(unitDir, 'guide.md')

    if (!existsSync(metaPath) || !existsSync(guidePath)) {
      errors.push(`${GUIDES_SOURCE_LABEL}/${slug}: a guide unit requires both meta.json and guide.md`)
      continue
    }

    units.push({ slug, dir: unitDir, metaPath, guidePath })
  }

  return units.sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * Validates a guide's parsed meta.json against the guide-meta v1 schema.
 *
 * @param meta - Parsed metadata candidate
 * @param unit - The guide unit the metadata belongs to
 * @param libraries - All library sources, for validating package association
 * @param errors - Accumulator for validation errors
 * @returns True when the metadata passed every structural check
 */
function validateMeta(meta: GuideMeta, unit: GuideUnit, libraries: LibrarySource[], errors: string[]): boolean {
  const at = `${GUIDES_SOURCE_LABEL}/${unit.slug}/meta.json`
  const before = errors.length

  if (meta.schemaVersion !== 1) errors.push(`${at}: schemaVersion must be 1`)
  if (!GUIDE_TYPES.includes(meta.type)) errors.push(`${at}: type must be one of ${GUIDE_TYPES.join(', ')}`)
  if (!meta.title || typeof meta.title !== 'string') errors.push(`${at}: title is required`)
  if (!meta.problem || typeof meta.problem !== 'string') errors.push(`${at}: problem is required`)
  if (!meta.outcome || typeof meta.outcome !== 'string') errors.push(`${at}: outcome is required`)
  if (!GUIDE_PRIORITIES.includes(meta.priority)) errors.push(`${at}: priority must be one of ${GUIDE_PRIORITIES.join(', ')}`)

  // why: A guide belongs to the docs site, not to a package tree, so `packages` is the only statement of which packages it concerns; the first entry is the one the guide is primarily about and drives its placement on library pages.
  if (!isArray(meta.packages) || meta.packages.length === 0) {
    errors.push(`${at}: packages must be a non-empty array; the first entry is the package the guide is primarily about`)
  } else {
    for (const packageName of meta.packages) {
      if (!libraries.some((lib) => lib.packageName === packageName)) {
        errors.push(`${at}: packages entry '${packageName}' is not a documented package`)
      }
    }
  }

  if (!meta.verification || !VERIFICATION_KINDS.includes(meta.verification.kind)) {
    errors.push(`${at}: verification.kind must be one of ${VERIFICATION_KINDS.join(', ')}`)
  } else if (meta.verification.kind === 'authored') {
    if (!meta.verification.verifiedAgainst) {
      errors.push(`${at}: verification.kind 'authored' requires verifiedAgainst, e.g. '@hyperfrontend/nexus@2.0.1'`)
    }
    if (!meta.verification.verifiedOn || !ISO_DATE.test(meta.verification.verifiedOn)) {
      errors.push(`${at}: verification.kind 'authored' requires verifiedOn as an ISO date (YYYY-MM-DD)`)
    }
  } else if (!meta.verification.source) {
    errors.push(`${at}: verification.kind 'demo' requires a workspace-relative 'source' path to the shipped file carrying the regions`)
  } else if (!existsSync(join(WORKSPACE_ROOT, meta.verification.source))) {
    errors.push(`${at}: verification.source '${meta.verification.source}' does not exist`)
  }

  for (const source of meta.snippetSources ?? []) {
    if (!existsSync(join(WORKSPACE_ROOT, source))) {
      errors.push(`${at}: snippetSources entry '${source}' does not exist`)
    }
  }

  return errors.length === before
}

/**
 * A TypeDoc reflection node, narrowed to the fields this compiler reads.
 */
interface TypedocReflection {
  /** Symbol name */
  name?: string
  /** Nested reflections */
  children?: unknown[]
}

/**
 * Collects every reflection name from a TypeDoc JSON tree.
 *
 * @param node - A TypeDoc reflection node
 * @param names - Accumulator receiving every encountered name
 */
function collectTypedocNames(node: TypedocReflection, names: Set<string>): void {
  if (typeof node.name === 'string') names.add(node.name)
  if (isArray(node.children)) {
    for (const child of node.children) {
      collectTypedocNames(child as TypedocReflection, names)
    }
  }
}

/**
 * Verifies that every `apis` entry names a symbol present in the TypeDoc JSON
 * generated for its package in the same run.
 *
 * @param meta - Guide metadata carrying the optional `apis` list
 * @param unit - The guide unit under validation
 * @param libraries - All library sources, for package-to-slug resolution
 * @param errors - Accumulator for validation errors
 */
function verifyApis(meta: GuideMeta, unit: GuideUnit, libraries: LibrarySource[], errors: string[]): void {
  const at = `${GUIDES_SOURCE_LABEL}/${unit.slug}/meta.json`

  for (const api of meta.apis ?? []) {
    const lib = libraries.find((candidate) => candidate.packageName === api.package)
    if (!lib) {
      errors.push(`${at}: apis entry references unknown package '${api.package}'`)
      continue
    }
    const apiJsonPath = join(API_OUTPUT, lib.slug, 'api.json')
    if (!existsSync(apiJsonPath)) {
      // why: --guides-only runs skip TypeDoc, so a missing api.json is a stale-state warning rather than an authoring error
      logger.log(`  ⚠ ${unit.slug}: cannot verify api '${api.symbol}' (${lib.slug}/api.json not generated in this run)`)
      continue
    }
    const names = createSet<string>()
    collectTypedocNames(parse(readFileSync(apiJsonPath, 'utf-8')), names)
    if (!names.has(api.symbol)) {
      errors.push(`${at}: apis entry '${api.symbol}' is not an exported symbol of ${api.package}`)
    }
  }
}

/**
 * Parses `ref: [guide:<slug>/<region>] start|end` marker regions belonging to
 * one guide out of a source file.
 *
 * @param sourceRelPath - Workspace-relative path of the file to scan
 * @param slug - Guide slug whose regions should be collected
 * @param errors - Accumulator for validation errors
 * @returns Map of region name to extracted snippet
 */
function parseRegions(sourceRelPath: string, slug: string, errors: string[]): Map<string, SnippetRegion> {
  const regions = createMap<string, SnippetRegion>()
  const lines = readFileSync(join(WORKSPACE_ROOT, sourceRelPath), 'utf-8').split('\n')
  const marker = /\/\/\s*ref:\s*\[guide:([a-z0-9-]+)\/([a-z0-9-]+)\]\s*(start|end)\s*$/
  const open = createMap<string, number>()

  for (let i = 0; i < lines.length; i++) {
    const match = marker.exec(lines[i])
    if (!match || match[1] !== slug) continue
    const [, , region, edge] = match

    if (edge === 'start') {
      if (open.has(region) || regions.has(region)) {
        errors.push(`${sourceRelPath}: duplicate region '${region}' for guide '${slug}'`)
        continue
      }
      open.set(region, i)
    } else {
      const startIndex = open.get(region)
      if (startIndex === undefined) {
        errors.push(`${sourceRelPath}: 'end' marker for region '${region}' of guide '${slug}' has no matching 'start'`)
        continue
      }
      open.delete(region)
      regions.set(region, {
        code: dedent(lines.slice(startIndex + 1, i)),
        sourcePath: sourceRelPath,
        startLine: startIndex + 2,
        endLine: i,
      })
    }
  }

  for (const [region] of open) {
    errors.push(`${sourceRelPath}: region '${region}' of guide '${slug}' is never closed with an 'end' marker`)
  }

  return regions
}

/**
 * Strips the longest common leading whitespace from a block of lines.
 *
 * @param lines - Raw source lines between two region markers
 * @returns The dedented block joined back into a string
 */
function dedent(lines: string[]): string {
  let margin: number | null = null
  for (const line of lines) {
    if (line.trim() === '') continue
    const indent = line.length - line.trimStart().length
    margin = margin === null ? indent : min(margin, indent)
  }
  const cut = margin ?? 0
  return lines
    .map((line) => (line.trim() === '' ? '' : line.slice(cut)))
    .join('\n')
    .trim()
}

/**
 * Picks the fenced-code language for a snippet based on its source file.
 *
 * @param sourcePath - Workspace-relative source path
 * @returns Language identifier for the rendered code fence
 */
function fenceLanguage(sourcePath: string): string {
  if (sourcePath.endsWith('.tsx')) return 'tsx'
  if (sourcePath.endsWith('.js') || sourcePath.endsWith('.mjs')) return 'js'
  if (sourcePath.endsWith('.vue')) return 'vue'
  return 'ts'
}

/**
 * Replaces every `<!-- snippet: <region> -->` placeholder in a guide with the
 * extracted code and a source link to its executable twin, labelled with the
 * exact line range so the reader sees where the example lives before clicking.
 *
 * @param unit - The guide unit being compiled
 * @param meta - The guide's validated metadata
 * @param errors - Accumulator for validation errors
 * @returns The compiled guide markdown
 */
function resolveSnippets(unit: GuideUnit, meta: GuideMeta, errors: string[]): string {
  const at = `${GUIDES_SOURCE_LABEL}/${unit.slug}/guide.md`
  const content = readFileSync(unit.guidePath, 'utf-8')

  const sourceFiles: string[] = []
  if (meta.verification.source) sourceFiles.push(meta.verification.source)
  sourceFiles.push(...(meta.snippetSources ?? []))

  const regions = createMap<string, SnippetRegion>()
  for (const sourceFile of sourceFiles) {
    for (const [name, region] of parseRegions(sourceFile, unit.slug, errors)) {
      if (regions.has(name)) {
        errors.push(`${at}: region '${name}' is defined in more than one snippet source`)
        continue
      }
      regions.set(name, region)
    }
  }

  const used = createSet<string>()
  const compiled = content.replace(/<!--\s*snippet:\s*([a-z0-9-]+)\s*-->/g, (placeholder, name: string) => {
    const region = regions.get(name)
    if (!region) {
      errors.push(`${at}: snippet placeholder '${name}' has no matching region in ${sourceFiles.join(', ') || '(no sources declared)'}`)
      return placeholder
    }
    used.add(name)
    const lineRange = `#L${region.startLine}-L${region.endLine}`
    const url = `${GITHUB_BLOB_BASE}/${region.sourcePath}${lineRange}`
    const fence = `\`\`\`${fenceLanguage(region.sourcePath)}\n${region.code}\n\`\`\``
    return `${fence}\n\n<sub>e.g. [${region.sourcePath}${lineRange}](${url})</sub>`
  })

  for (const [name] of regions) {
    if (!used.has(name)) {
      errors.push(`${at}: region '${name}' exists in a snippet source but is never referenced by a placeholder`)
    }
  }

  if (!compiled.startsWith('# ')) {
    errors.push(`${at}: guide.md must start with a '# <Title>' heading`)
  }

  return compiled
}

/**
 * Builds the machine-readable index entry for one compiled guide.
 *
 * @param unit - The compiled guide unit
 * @param meta - The guide's validated metadata
 * @param compiled - The guide's compiled markdown, mined for the headings the index carries
 * @returns Index entry exposing the guide to the site, search, and external consumers
 */
function toIndexEntry(unit: GuideUnit, meta: GuideMeta, compiled: string): GuideIndexEntry {
  return {
    slug: unit.slug,
    route: `/docs/guides/${unit.slug}`,
    type: meta.type,
    title: meta.title,
    problem: meta.problem,
    outcome: meta.outcome,
    priority: meta.priority,
    packages: meta.packages,
    verification: meta.verification,
    demo: meta.demo,
    complexity: meta.complexity,
    estMinutes: meta.estMinutes,
    prerequisites: meta.prerequisites,
    related: meta.related,
    keywords: meta.keywords ?? [],
    headings: extractMarkdownSections(compiled).map((section) => section.title),
  }
}

/**
 * Checks that a site-relative route is served by a real page.
 *
 * @param route - Site-relative route such as `/docs/libraries/nexus`
 * @returns True when the route resolves to a page component
 */
function routeExists(route: string): boolean {
  return existsSync(join(APP_DIR, route.replace(/^\//, ''), 'page.tsx'))
}

/**
 * Validates cross-guide references and outbound routes once the whole corpus
 * is known. Guide pages render these links, so a stale one is a broken link.
 *
 * @param entries - All compiled index entries
 * @param errors - Accumulator for validation errors
 */
function verifyCrossReferences(entries: GuideIndexEntry[], errors: string[]): void {
  const slugs = createSet(entries.map((entry) => entry.slug))
  for (const entry of entries) {
    for (const ref of [...(entry.prerequisites?.guides ?? []), ...(entry.related?.guides ?? [])]) {
      if (!slugs.has(ref)) {
        errors.push(`guide '${entry.slug}' references guide '${ref}', which does not exist`)
      }
    }
    for (const route of [...(entry.related?.reference ?? []), ...(entry.related?.explanation ?? [])]) {
      if (!routeExists(route)) {
        errors.push(`guide '${entry.slug}' links related route '${route}', which has no page`)
      }
    }
  }
}

/**
 * One compiled guide awaiting emission once the whole corpus validates.
 */
interface CompiledUnit {
  /** Guide slug */
  slug: string
  /** Compiled guide markdown */
  compiled: string
}

/**
 * Compiles every guide unit into `.generated/guides/` and emits the corpus
 * index to both `.generated/guides/index.json` and `public/guides/index.json`.
 *
 * Fails loudly (throws) on any authoring error so the docs build cannot ship a
 * guide whose code does not execute or whose metadata is malformed.
 *
 * @param libraries - Library sources to scan for guide units
 * @returns The compiled guide index
 */
function generateGuides(libraries: LibrarySource[]): GuideIndex {
  logger.log('📖 Compiling guides...')

  const errors: string[] = []
  const units = discoverGuideUnits(errors)
  const compiledUnits: CompiledUnit[] = []
  const entries: GuideIndexEntry[] = []

  for (const unit of units) {
    let meta: GuideMeta
    try {
      meta = parse(readFileSync(unit.metaPath, 'utf-8'))
    } catch {
      errors.push(`${GUIDES_SOURCE_LABEL}/${unit.slug}/meta.json: invalid JSON`)
      continue
    }

    if (!validateMeta(meta, unit, libraries, errors)) continue
    verifyApis(meta, unit, libraries, errors)

    const compiled = resolveSnippets(unit, meta, errors)
    compiledUnits.push({ slug: unit.slug, compiled })
    entries.push(toIndexEntry(unit, meta, compiled))
    logger.log(`  ✓ ${unit.slug} (${meta.type}, ${meta.packages[0]})`)
  }

  verifyCrossReferences(entries, errors)

  // why: Nothing is written until the whole corpus validates, so a failed run cannot leave partial guides for validate-links or the loader to trip over
  if (errors.length > 0) {
    logger.log('\n❌ Guide compilation failed:')
    for (const error of errors) logger.log(`  ✗ ${error}`)
    throw createError(`guide compilation failed with ${errors.length} error(s):\n${errors.map((error) => `  - ${error}`).join('\n')}`)
  }

  for (const { slug, compiled } of compiledUnits) {
    const outputPath = join(GUIDES_OUTPUT, slug, 'guide.md')
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, compiled)
  }

  const index: GuideIndex = { schemaVersion: 1, generatedAt: createDate().toISOString(), guides: entries }
  mkdirSync(GUIDES_OUTPUT, { recursive: true })
  writeFileSync(join(GUIDES_OUTPUT, 'index.json'), stringify(index, null, 2))
  mkdirSync(dirname(PUBLIC_INDEX), { recursive: true })
  writeFileSync(PUBLIC_INDEX, stringify(index, null, 2))

  logger.log(`  ${entries.length} guide(s) compiled\n`)
  return index
}

export { generateGuides }
