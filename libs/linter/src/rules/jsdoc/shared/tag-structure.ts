/**
 * What each tag takes in the TypeScript flavour of JSDoc: whether it may or must carry a type
 * and a name, and whether another flavour reads it otherwise, which the messages then mention.
 *
 * @module rules/jsdoc/shared/tag-structure
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** Whether a tag may carry a part: yes, only in another flavour, or in none. */
export type Allowance = 'yes' | 'other' | 'no'

/** Whether a tag must carry a part: no, in every flavour, or in this flavour only. */
export type Requirement = 'no' | 'yes' | 'mode'

/** What a tag takes. */
export interface TagStructure {
  /** Whether it may carry a type. */
  readonly type: Allowance
  /** Whether it may carry a name. */
  readonly name: Allowance
  /** Whether it must carry a type. */
  readonly typeRequired: Requirement
  /** Whether it must carry a name. */
  readonly nameRequired: Requirement
  /** Whether it must carry a type or a name. */
  readonly either: Requirement
}

/** What a tag takes when nothing restricts it. */
const OPEN: TagStructure = { type: 'yes', name: 'yes', typeRequired: 'no', nameRequired: 'no', either: 'no' }

/** The tags taking no type, which need a name. */
const NAMED_UNTYPED: Partial<TagStructure> = { type: 'no', nameRequired: 'yes' }

/** The tags whose type only another flavour allows. */
const TYPED_ELSEWHERE: Partial<TagStructure> = { type: 'other' }

/** The tags needing a type or a name. */
const EITHER: Partial<TagStructure> = { either: 'yes' }

/** The structures that differ from the open one. */
const STRUCTURES = createMap<string, Partial<TagStructure>>([
  ['alias', EITHER],
  ['augments', EITHER],
  ['callback', { nameRequired: 'yes' }],
  ['constructs', { type: 'no' }],
  ['emits', NAMED_UNTYPED],
  ['event', { nameRequired: 'yes' }],
  ['export', TYPED_ELSEWHERE],
  ['exports', TYPED_ELSEWHERE],
  ['extends', { either: 'mode' }],
  ['external', NAMED_UNTYPED],
  ['fires', NAMED_UNTYPED],
  ['function', { type: 'no' }],
  ['host', NAMED_UNTYPED],
  ['implements', { typeRequired: 'yes' }],
  ['interface', { type: 'no' }],
  ['internal', { name: 'no' }],
  ['lends', EITHER],
  ['listens', NAMED_UNTYPED],
  ['memberof', EITHER],
  ['memberof!', EITHER],
  ['mixes', EITHER],
  ['mixin', { type: 'no' }],
  ['name', { nameRequired: 'yes' }],
  ['package', TYPED_ELSEWHERE],
  ['private', TYPED_ELSEWHERE],
  ['protected', TYPED_ELSEWHERE],
  ['public', TYPED_ELSEWHERE],
  ['requires', NAMED_UNTYPED],
  ['satisfies', { typeRequired: 'yes' }],
  ['static', TYPED_ELSEWHERE],
  ['template', { nameRequired: 'mode' }],
  ['this', { typeRequired: 'mode', name: 'other' }],
  ['tutorial', NAMED_UNTYPED],
  ['type', { typeRequired: 'yes' }],
])

/**
 * What a tag takes.
 *
 * @param tag - The tag's name without `@`
 * @returns Its structure, open for a tag nothing restricts
 *
 * @example Look up what a tag may and must carry
 * ```ts
 * structureOf('emits')
 * // => { type: 'no', name: 'yes', typeRequired: 'no', nameRequired: 'yes', either: 'no' }
 * structureOf('type').typeRequired // => 'yes'
 * structureOf('since').type // => 'yes' (an unrestricted tag)
 * ```
 */
export function structureOf(tag: string): TagStructure {
  return { ...OPEN, ...STRUCTURES.get(tag) }
}
