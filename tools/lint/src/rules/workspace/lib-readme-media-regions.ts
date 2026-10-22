/**
 * The media regions a publishable library README declares for its distribution readme are ones
 * the build can honour: each reads, names a committed scene with a portable asset and, when it
 * links, links to a page and anchor the documentation site publishes. The README carries the
 * runtimes region inside its Compatibility section, the banner the build puts in place of the
 * title is recorded, and no region repeats that banner.
 *
 * @module rules/workspace/lib-readme-media-regions
 */

import type { MarkdownNode } from '../../markdown/model.ts'
import { existsSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseMarkers } from '@hyperfrontend/package/readme/markers'
import { packageBanner, resolveDocs } from '@hyperfrontend/package/readme/transform'
import { defineRule } from '../../engine/rule.ts'
import { linkProblem } from './shared/docs-anchors.ts'
import { docsIndex, packageOfFile, repositoryUrl } from './shared/docs-catalog.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'

/** The rule's options. */
interface Options {
  /** Directory, relative to the workspace root, holding the committed media. */
  readonly assetRoot?: string
  /** Origin every `docs` attribute resolves under. */
  readonly siteUrl?: string
  /** The site project, relative to the workspace root, whose routes say which pages exist. */
  readonly docsSiteRoot?: string
  /** Browsable repository URL, for a `docs` attribute that points there. */
  readonly repoUrl?: string
}

/** The scope a package's scenes drop from its name. */
const SCOPE = '@hyperfrontend/'

/** The section the runtimes region belongs in, matched at the start of a line. */
const COMPATIBILITY = '## Compatibility'

/** The extensions a portable asset is recorded under; a themed file never counts. */
const PORTABLE = ['gif', 'webp', 'png']

/**
 * Names the portable files an asset may be recorded as.
 *
 * @param stem - The asset's filename stem
 * @returns The names, joined for a message
 */
function portableNames(stem: string): string {
  return `${stem}.gif, ${stem}.webp or ${stem}.png`
}

/**
 * Tells whether a scene directory holds a portable file for an asset.
 *
 * @param scene - The scene directory
 * @param stem - The asset's filename stem
 * @returns True when one is recorded
 */
function recorded(scene: string, stem: string): boolean {
  return PORTABLE.some((extension) => existsSync(join(scene, `${stem}.${extension}`)))
}

/**
 * Tells whether a path is a directory.
 *
 * @param path - An absolute path that may not exist
 * @returns True for a directory
 */
function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/**
 * Tells whether a line sits outside the Compatibility section, which runs from its heading to
 * the next second- or third-level heading; a README with no such section has nothing to be
 * outside of.
 *
 * @param lines - The README's lines
 * @param line - The 0-based line
 * @returns True when the README has the section and the line is not in it
 */
function outsideCompatibility(lines: readonly string[], line: number): boolean {
  const heading = lines.findIndex((text) => text.startsWith(COMPATIBILITY))
  if (heading === -1) return false
  return line <= heading || lines.slice(heading + 1, line + 1).some((text) => text.startsWith('## ') || text.startsWith('### '))
}

export default defineRule<Options | undefined, MarkdownNode>({
  id: 'workspace/lib-readme-media-regions',
  language: 'markdown',
  fixable: false,
  create(context) {
    const path = context.file.path
    const directory = dirname(path)
    const root = workspaceRootOf(directory)
    if (basename(path) !== 'README.md' || root === null || !isPublishableLibrary(directory)) return {}
    const name = readPackageFile(directory)?.name
    if (typeof name !== 'string' || name === '') return {}
    const options = context.options ?? {}
    const index = docsIndex(root, join(root, options.docsSiteRoot ?? 'apps/docs-site'))
    const documented = packageOfFile(index, path)
    if (documented === null) return {}
    const assetRoot = options.assetRoot ?? 'assets/media'
    const siteUrl = options.siteUrl ?? 'https://www.hyperfrontend.dev'
    const origins = { siteUrl, repoUrl: options.repoUrl ?? repositoryUrl(root) ?? '' }
    const short = name.startsWith(SCOPE) ? name.slice(SCOPE.length) : name
    return {
      root() {
        const lines = context.file.text.split(/\r?\n/)
        const starts = context.file.lines.starts

        /**
         * Reports a problem on a whole line.
         *
         * @param line - The 0-based line
         * @param message - What the rule reports
         */
        const onLine = (line: number, message: string): void => {
          const start = starts[line] as number
          context.report({ start, end: start + (lines[line] as string).length, message })
        }

        const { directives, problems } = parseMarkers(context.file.text)
        for (const problem of problems) onLine(problem.line, `This media region cannot be read: ${problem.reason}`)
        for (const directive of directives) {
          const at = directive.startLine
          if (directive.id === 'banner') {
            onLine(
              at,
              'The build places the package banner in place of the title; remove this region, or the distribution readme shows the banner twice.'
            )
            continue
          }
          const scene = join(root, assetRoot, directive.scene)
          if (!isDirectory(scene)) {
            onLine(
              at,
              `No committed scene "${directive.scene}" under ${assetRoot}. Record it with the media tool, or correct the scene attribute.`
            )
          } else if (!recorded(scene, directive.asset)) {
            onLine(
              at,
              `Scene "${directive.scene}" has no portable ${portableNames(directive.asset)}. Record it, or correct the asset attribute; a themed file is never what a readme embeds.`
            )
          } else if (directive.docs !== undefined) {
            const href = resolveDocs(directive.docs, `${siteUrl}${documented.route}`)
            const reason = linkProblem(index, origins, href, path)
            if (reason !== null)
              onLine(at, `The docs attribute of region "${directive.id}" resolves to ${href}, which does not resolve: ${reason}`)
          }
          if (directive.id !== 'runtimes') continue
          if (directive.scene !== `runtimes-${short}` || directive.asset !== 'runtimes') {
            onLine(at, `Region "runtimes" must name scene "runtimes-${short}" and asset "runtimes".`)
          }
          if (outsideCompatibility(lines, at)) onLine(at, 'Region "runtimes" belongs inside the Compatibility section.')
        }
        const banner = packageBanner(name, SCOPE)
        if (!recorded(join(root, assetRoot, banner.scene), banner.asset)) {
          const title = lines.findIndex((text) => text.startsWith('# '))
          onLine(
            max(title, 0),
            `The distribution readme opens with the package banner in place of this title, and no portable ${portableNames(banner.asset)} is recorded under ${assetRoot}/${banner.scene}. Record it: npx nx media tool-media --scene=${banner.scene}`
          )
        }
        if (!directives.some((directive) => directive.id === 'runtimes')) {
          onLine(
            0,
            `A publishable README declares a "runtimes" region naming scene "runtimes-${short}" and asset "runtimes", inside the Compatibility section, so the distribution readme carries the package runtimes.`
          )
        }
      },
    }
  },
})
