import type { Rule } from 'eslint'
import type { LinkOrigins } from '../utils/docs-links'
import { basename, dirname, join } from 'node:path'
import { parseMarkers, resolveDocs } from '@hyperfrontend/package'
import { validateLink } from '../utils/docs-link-validation'
import { getDocsTargetIndex, packageOfFile, readRepositoryUrl } from '../utils/docs-targets'
import { exists, isDirectory } from '../utils/fs'
import { isPublishableLibrary, readPackageJson } from '../utils/nx-project'
import { findNxWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-readme-media-regions rule.
 */
export const RULE_NAME = 'lib-readme-media-regions'

/** Directory, relative to the workspace root, that holds the committed media assets. */
export const DEFAULT_ASSET_ROOT = 'assets/media'

/** Origin of the documentation site, where every package's pages are published. */
export const DEFAULT_SITE_URL = 'https://www.hyperfrontend.dev'

/** Where the documentation site's project lives, relative to the workspace root. */
export const DEFAULT_DOCS_SITE_ROOT = 'apps/docs-site'

/** The scope every package here is published under, stripped to name a package's scenes. */
const SCOPE = '@hyperfrontend/'

/** The formats a portable asset is looked for in, in the order the build prefers them. */
const PORTABLE_EXTENSIONS: readonly string[] = ['gif', 'webp', 'png']

/** The heading of the section the runtime strip replaces. */
const COMPATIBILITY_HEADING = '## Compatibility'

/**
 * One region every publishable readme declares.
 */
export interface RequiredRegion {
  /** The region's identifier. */
  id: string
  /** What the scene it names starts with; the package's short name follows. */
  scenePrefix: string
  /** The asset stem it names. */
  asset: string
  /** Where in the document it sits, as told to an author. */
  place: string
}

/**
 * The regions every publishable readme carries, so the distribution readme
 * shows the package's banner and its runtime strip.
 */
export const REQUIRED_REGIONS: readonly RequiredRegion[] = [
  { id: 'banner', scenePrefix: 'banner-', asset: 'banner', place: 'above the first section heading, below the badges' },
  { id: 'runtimes', scenePrefix: 'runtimes-', asset: 'runtimes', place: 'inside the Compatibility section' },
]

/**
 * Options accepted by the rule.
 */
export interface ReadmeMediaRegionsOptions {
  /** Directory, relative to the workspace root, that holds the committed media. */
  assetRoot?: string
  /** Origin of the documentation site; every `docs` attribute resolves under it. */
  siteUrl?: string
  /** The documentation site's project, relative to the workspace root, whose routes and content say which pages exist. */
  docsSiteRoot?: string
  /** Browsable repository URL; read from the workspace manifest when omitted. */
  repoUrl?: string
}

/**
 * Whether a region sits where its kind belongs.
 *
 * The banner sits in the top matter, above the first section heading, and the
 * runtime strip sits inside the Compatibility section. A document with no
 * Compatibility heading is left to the structure rule, which reports the
 * missing section itself.
 *
 * @param lines - The document's lines.
 * @param id - The region's identifier, one of the required ones.
 * @param line - Index of the line the region starts on.
 * @returns True when the region is where it belongs.
 */
export function isWellPlaced(lines: readonly string[], id: string, line: number): boolean {
  if (id === 'banner') {
    const firstSection = lines.findIndex((text) => text.startsWith('## '))
    return firstSection === -1 || line < firstSection
  }
  const compatibility = lines.findIndex((text) => text.startsWith(COMPATIBILITY_HEADING))
  if (compatibility === -1) {
    return true
  }
  const end = lines.findIndex((text, index) => index > compatibility && (text.startsWith('## ') || text.startsWith('### ')))
  return line > compatibility && (end === -1 || line < end)
}

/**
 * Whether a scene holds the portable file of an asset.
 *
 * @param sceneDir - Absolute directory the scene's assets sit in.
 * @param asset - The asset's filename stem.
 * @returns True when the animation or a still exists under the bare stem.
 */
export function hasPortableAsset(sceneDir: string, asset: string): boolean {
  return PORTABLE_EXTENSIONS.some((extension) => exists(join(sceneDir, `${asset}.${extension}`)))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate the media regions a publishable library README declares for its distribution readme',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [
      {
        type: 'object',
        properties: {
          assetRoot: { type: 'string' },
          siteUrl: { type: 'string' },
          docsSiteRoot: { type: 'string' },
          repoUrl: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unreadable: 'This media region cannot be read: {{reason}}',
      missingScene: 'No committed scene "{{scene}}" under {{assetRoot}}. Record it with the media tool, or correct the scene attribute.',
      missingAsset:
        'Scene "{{scene}}" has no portable {{asset}}.gif, {{asset}}.webp or {{asset}}.png. Record it, or correct the asset attribute; a themed file is never what a readme embeds.',
      brokenDocs: 'The docs attribute of region "{{id}}" resolves to {{href}}, which does not resolve: {{reason}}',
      missingRegion:
        'A publishable README declares a "{{id}}" region naming scene "{{scene}}" and asset "{{asset}}", {{place}}, so the distribution readme carries the package {{id}}.',
      wrongRegion: 'Region "{{id}}" must name scene "{{scene}}" and asset "{{asset}}".',
      misplacedRegion: 'Region "{{id}}" belongs {{place}}.',
    },
  },

  create(context) {
    const filename = context.filename
    if (basename(filename) !== 'README.md') {
      return {}
    }
    const projectRoot = dirname(filename)
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }
    const workspaceRoot = findNxWorkspaceRoot(projectRoot)
    const packageName = readPackageJson(projectRoot)?.name
    if (workspaceRoot === null || packageName === undefined) {
      return {}
    }
    const options = (context.options[0] ?? {}) as ReadmeMediaRegionsOptions
    const index = getDocsTargetIndex(workspaceRoot, join(workspaceRoot, options.docsSiteRoot ?? DEFAULT_DOCS_SITE_ROOT))
    const pkg = packageOfFile(index, filename)
    if (pkg === null) {
      return {}
    }
    const assetRoot = options.assetRoot ?? DEFAULT_ASSET_ROOT
    const mediaRoot = join(workspaceRoot, assetRoot)
    const shortName = packageName.startsWith(SCOPE) ? packageName.slice(SCOPE.length) : packageName
    const origins: LinkOrigins = {
      siteUrl: (options.siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, ''),
      repoUrl: options.repoUrl ?? readRepositoryUrl(workspaceRoot) ?? '',
    }
    const landing = `${origins.siteUrl}${pkg.route}`

    return {
      root(node: Rule.Node) {
        const text = context.sourceCode.getText()
        const lines = text.split('\n')
        const report = (messageId: string, line: number, data: Record<string, string>): void => {
          context.report({
            node,
            loc: { start: { line: line + 1, column: 0 }, end: { line: line + 1, column: (lines[line] ?? '').length } },
            messageId,
            data,
          })
        }

        const { directives, problems } = parseMarkers(text)
        for (const problem of problems) {
          report('unreadable', problem.line, { reason: problem.reason })
        }
        for (const directive of directives) {
          const sceneDir = join(mediaRoot, directive.scene)
          if (!isDirectory(sceneDir)) {
            report('missingScene', directive.startLine, { scene: directive.scene, assetRoot })
            continue
          }
          if (!hasPortableAsset(sceneDir, directive.asset)) {
            report('missingAsset', directive.startLine, { scene: directive.scene, asset: directive.asset })
            continue
          }
          if (directive.docs === undefined) {
            continue
          }
          const href = resolveDocs(directive.docs, landing)
          const verdict = validateLink(index, origins, href, filename)
          if (verdict.ok === false) {
            report('brokenDocs', directive.startLine, { id: directive.id, href, reason: verdict.reason })
          }
        }
        for (const required of REQUIRED_REGIONS) {
          const scene = `${required.scenePrefix}${shortName}`
          const found = directives.find((directive) => directive.id === required.id)
          if (found === undefined) {
            report('missingRegion', 0, { id: required.id, scene, asset: required.asset, place: required.place })
            continue
          }
          if (found.scene !== scene || found.asset !== required.asset) {
            report('wrongRegion', found.startLine, { id: required.id, scene, asset: required.asset })
          }
          if (!isWellPlaced(lines, required.id, found.startLine)) {
            report('misplacedRegion', found.startLine, { id: required.id, place: required.place })
          }
        }
      },
    }
  },
}

export default rule
