/**
 * Every secondary entry a publishable library exports has a README beside its source, opening
 * with a heading that names the entry and a line that describes it, because the documentation
 * site renders that README above the entry's API reference.
 *
 * @module rules/workspace/lib-pkg-secondary-entry-readme
 */

import { readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { propertyOf } from '@hyperfrontend/linter/helpers'
import { manifestRule } from './shared/manifest-rule.ts'

/** What a README's opening says. */
interface Opening {
  /** The heading's text, lowercased, without a trailing slash or ` module`. */
  readonly heading: string | null
  /** Whether a line of prose follows the heading. */
  readonly described: boolean
}

/**
 * Reads the opening of a README.
 *
 * @param file - The README's absolute path
 * @returns The opening, or null when the file cannot be read
 */
function readOpening(file: string): Opening | null {
  let lines: string[]
  try {
    lines = readFileSync(file, 'utf8').split(/\r?\n/)
  } catch {
    return null
  }
  const content = lines.map((line) => line.trim()).filter((line) => line !== '')
  const first = content[0] ?? ''
  if (!first.startsWith('# ')) return { heading: null, described: false }
  let heading = first.slice(2).trim().toLowerCase()
  if (heading.endsWith('/')) heading = heading.slice(0, -1)
  if (heading.endsWith(' module')) heading = heading.slice(0, -7)
  const second = content[1]
  return { heading, described: second !== undefined && !second.startsWith('#') }
}

export default manifestRule('workspace/lib-pkg-secondary-entry-readme', 'package.json', (root, context) => {
  const exports = propertyOf(root, 'exports')
  if (exports === null || exports.value.kind !== 'object') return
  for (const entry of exports.value.properties) {
    const key = entry.key.value as string
    if (key === '.' || key === './package.json' || key.includes('*') || !key.startsWith('./')) continue
    const subpath = key.slice(2)
    const expectedPath = posix.join('src', subpath, 'README.md')
    const moduleName = posix.basename(subpath)
    const opening = readOpening(join(dirname(context.file.path), 'src', subpath, 'README.md'))
    const where = { start: entry.start, end: entry.end }
    if (opening === null)
      context.report({ ...where, message: `Secondary entrypoint './${subpath}' is missing required README at ${expectedPath}` })
    else if (opening.heading !== moduleName.toLowerCase())
      context.report({
        ...where,
        message: `Secondary entrypoint './${subpath}' README at ${expectedPath} must start with '# ${moduleName}'`,
      })
    else if (!opening.described)
      context.report({
        ...where,
        message: `Secondary entrypoint './${subpath}' README at ${expectedPath} must include a description line beneath the H1`,
      })
  }
})
