import type { Schema, ValidationResult } from '@hyperfrontend/json-utils'
import type { Changelog } from './changelog'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { validate } from '@hyperfrontend/json-utils'

/**
 * Schema compatibility check result.
 */
export interface CompatibilityResult {
  /** Whether schemas are compatible */
  readonly compatible: boolean

  /** List of schema differences found */
  readonly differences: readonly SchemaDifference[]
}

/**
 * A single schema difference.
 */
export interface SchemaDifference {
  /** JSON path where difference was found */
  readonly path: string

  /** Type of difference */
  readonly type: 'type-mismatch' | 'missing-property' | 'extra-property'

  /** Type in source schema */
  readonly sourceType?: string

  /** Type in target schema */
  readonly targetType?: string
}

/**
 * JSON Schema for a ChangelogLink.
 */
const changelogLinkSchema: Schema = {
  type: 'object',
  required: ['label', 'url'],
  properties: {
    label: { type: 'string' },
    url: { type: 'string' },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for a CommitRef.
 */
const commitRefSchema: Schema = {
  type: 'object',
  required: ['hash', 'shortHash'],
  properties: {
    hash: { type: 'string', minLength: 7, maxLength: 40 },
    shortHash: { type: 'string', minLength: 7, maxLength: 7 },
    url: { type: 'string' },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for an IssueRef.
 */
const issueRefSchema: Schema = {
  type: 'object',
  required: ['number', 'type'],
  properties: {
    number: { type: 'integer', minimum: 1 },
    type: { type: 'string', enum: ['issue', 'pull-request'] },
    url: { type: 'string' },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for a ChangelogItem.
 */
const changelogItemSchema: Schema = {
  type: 'object',
  required: ['description', 'commits', 'references', 'breaking'],
  properties: {
    scope: { type: 'string' },
    description: { type: 'string' },
    breaking: { type: 'boolean' },
    commits: {
      type: 'array',
      items: commitRefSchema,
    },
    references: {
      type: 'array',
      items: issueRefSchema,
    },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for a ChangelogSection.
 */
const changelogSectionSchema: Schema = {
  type: 'object',
  required: ['type', 'heading', 'items'],
  properties: {
    type: {
      type: 'string',
      enum: [
        'breaking',
        'features',
        'fixes',
        'performance',
        'documentation',
        'deprecations',
        'refactoring',
        'tests',
        'build',
        'ci',
        'chores',
        'other',
      ],
    },
    heading: { type: 'string' },
    items: {
      type: 'array',
      items: changelogItemSchema,
    },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for a ChangelogEntry.
 */
const changelogEntrySchema: Schema = {
  type: 'object',
  required: ['version', 'date', 'unreleased', 'sections'],
  properties: {
    version: { type: 'string' },
    date: { type: ['string', 'null'] },
    unreleased: { type: 'boolean' },
    compareUrl: { type: 'string' },
    sections: {
      type: 'array',
      items: changelogSectionSchema,
    },
    rawContent: { type: 'string' },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for ChangelogHeader.
 */
const changelogHeaderSchema: Schema = {
  type: 'object',
  required: ['title', 'description', 'links'],
  properties: {
    title: { type: 'string' },
    description: {
      type: 'array',
      items: { type: 'string' },
    },
    links: {
      type: 'array',
      items: changelogLinkSchema,
    },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for ChangelogMetadata.
 */
const changelogMetadataSchema: Schema = {
  type: 'object',
  required: ['format', 'isConventional', 'warnings'],
  properties: {
    format: {
      type: 'string',
      enum: ['keep-a-changelog', 'conventional', 'custom', 'unknown'],
    },
    isConventional: { type: 'boolean' },
    repositoryUrl: { type: 'string' },
    packageName: { type: 'string' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
}

/**
 * JSON Schema for a complete Changelog document.
 * Used for validation and format compatibility checking.
 */
export const changelogSchema: Schema = {
  type: 'object',
  required: ['header', 'entries', 'metadata'],
  properties: {
    source: { type: 'string' },
    header: changelogHeaderSchema,
    entries: {
      type: 'array',
      items: changelogEntrySchema,
    },
    metadata: changelogMetadataSchema,
  },
  additionalProperties: false,
}

/**
 * Validates a changelog object against the schema.
 *
 * @param changelog - The changelog object to validate
 * @returns Validation result with any errors
 *
 * @example
 * ```ts
 * const result = validateChangelog(myChangelog)
 * if (!result.valid) {
 *   console.log('Validation errors:', result.errors)
 * }
 * ```
 */
export function validateChangelog(changelog: unknown): ValidationResult {
  return validate(changelog, changelogSchema)
}

/**
 * Checks if two changelogs have compatible schemas.
 * Used to detect format incompatibilities before merge/compare.
 *
 * @param source - The source changelog
 * @param target - The target changelog
 * @returns Compatibility result with any differences found
 *
 * @example
 * ```ts
 * const result = checkSchemaCompatibility(mainChangelog, branchChangelog)
 * if (!result.compatible) {
 *   console.log('Schema differences:', result.differences)
 * }
 * ```
 */
export function checkSchemaCompatibility(source: Changelog, target: Changelog): CompatibilityResult {
  const differences: SchemaDifference[] = []

  // Check format compatibility
  if (source.metadata.format !== target.metadata.format) {
    differences.push({
      path: 'metadata.format',
      type: 'type-mismatch',
      sourceType: source.metadata.format,
      targetType: target.metadata.format,
    })
  }

  // Check header structure
  if (source.header.title !== target.header.title) {
    // Title difference is not a schema incompatibility, just content difference
    // We only track structural differences
  }

  // Check section types used
  const sourceSectionTypes = createSet<string>()
  const targetSectionTypes = createSet<string>()

  for (const entry of source.entries) {
    for (const section of entry.sections) {
      sourceSectionTypes.add(section.type)
    }
  }

  for (const entry of target.entries) {
    for (const section of entry.sections) {
      targetSectionTypes.add(section.type)
    }
  }

  // Find section types in source but not in target
  for (const type of sourceSectionTypes) {
    if (!targetSectionTypes.has(type)) {
      differences.push({
        path: `sections[type=${type}]`,
        type: 'missing-property',
        sourceType: type,
      })
    }
  }

  // Find section types in target but not in source
  for (const type of targetSectionTypes) {
    if (!sourceSectionTypes.has(type)) {
      differences.push({
        path: `sections[type=${type}]`,
        type: 'extra-property',
        targetType: type,
      })
    }
  }

  return {
    compatible: differences.length === 0,
    differences,
  }
}
