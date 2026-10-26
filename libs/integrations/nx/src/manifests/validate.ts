/**
 * Checks a plugin's manifests the way Nx will read them: every entry names its implementation and
 * schema, and both files exist beside the manifest.
 *
 * @module manifests/validate
 */

import type { ManifestIssue } from './model'
import { posix } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Tells whether a path, relative to the manifest's directory, names an existing file. */
export type FileExists = (relativePath: string) => boolean

/** The file reference fields an entry must carry. */
interface EntryShape {
  /** The field naming the module. */
  readonly moduleField: 'implementation' | 'factory'
}

/**
 * Whether a module reference can be resolved: the path as written, or with a source or compiled
 * extension added, exists beside the manifest.
 *
 * @param reference - The reference as the manifest writes it, with or without an extension
 * @param exists - Tells whether a relative path names an existing file
 * @returns Whether some candidate exists
 */
function moduleExists(reference: string, exists: FileExists): boolean {
  const base = reference.replace(/^\.\//, '')
  return ['', '.ts', '.js', '.mjs', '.cjs', '/index.ts', '/index.js'].some((suffix) => exists(`${base}${suffix}`))
}

/**
 * The problems of one entry collection.
 *
 * @param collection - `executors` or `generators`
 * @param value - The collection as parsed from the manifest
 * @param shape - Which field names the module
 * @param exists - Tells whether a relative path names an existing file
 * @returns The problems found, in entry order
 */
function checkCollection(collection: string, value: unknown, shape: EntryShape, exists: FileExists): ManifestIssue[] {
  if (typeof value !== 'object' || value === null || isArray(value)) {
    return [{ path: collection, message: `"${collection}" must be an object keyed by name` }]
  }
  const issues: ManifestIssue[] = []
  for (const [name, entry] of entries(value as Record<string, unknown>)) {
    const path = `${collection}.${name}`
    if (typeof entry !== 'object' || entry === null || isArray(entry)) {
      issues.push({ path, message: 'must be an object' })
      continue
    }
    const fields = entry as Record<string, unknown>
    const moduleReference = fields[shape.moduleField]
    if (typeof moduleReference !== 'string' || moduleReference === '') {
      issues.push({ path, message: `"${shape.moduleField}" must name the module` })
    } else if (!moduleExists(moduleReference, exists)) {
      issues.push({ path, message: `"${shape.moduleField}" names a module that does not exist: ${moduleReference}` })
    }
    const schema = fields['schema']
    if (typeof schema !== 'string' || schema === '') {
      issues.push({ path, message: '"schema" must name the options schema' })
    } else if (posix.extname(schema) !== '.json') {
      issues.push({ path, message: `"schema" must name a JSON file: ${schema}` })
    } else if (!exists(schema.replace(/^\.\//, ''))) {
      issues.push({ path, message: `"schema" names a file that does not exist: ${schema}` })
    }
  }
  return issues
}

/**
 * The problems of an `executors.json`.
 *
 * @param manifest - The manifest as parsed
 * @param exists - Tells whether a path relative to the manifest's directory names an existing file
 * @returns The problems found; empty when Nx can read every executor
 */
export function validateExecutorsManifest(manifest: unknown, exists: FileExists): ManifestIssue[] {
  if (typeof manifest !== 'object' || manifest === null || isArray(manifest)) {
    return [{ path: '', message: 'the manifest must be an object' }]
  }
  return checkCollection('executors', (manifest as Record<string, unknown>)['executors'], { moduleField: 'implementation' }, exists)
}

/**
 * The problems of a `generators.json`.
 *
 * @param manifest - The manifest as parsed
 * @param exists - Tells whether a path relative to the manifest's directory names an existing file
 * @returns The problems found; empty when Nx can read every generator
 */
export function validateGeneratorsManifest(manifest: unknown, exists: FileExists): ManifestIssue[] {
  if (typeof manifest !== 'object' || manifest === null || isArray(manifest)) {
    return [{ path: '', message: 'the manifest must be an object' }]
  }
  return checkCollection('generators', (manifest as Record<string, unknown>)['generators'], { moduleField: 'factory' }, exists)
}
