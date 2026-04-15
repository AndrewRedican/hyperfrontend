/**
 * Immutable changelog operations for adding, removing, filtering, merging, and transforming.
 *
 * @module @hyperfrontend/versioning/changelog/operations
 */
export type { AddEntryOptions } from './add-entry'
export type { EntryPredicate, SectionPredicate, ItemPredicate } from './filter-by-predicate'
export type { MergeStrategy, MergeOptions, MergeResult, MergeStats } from './merge'
export type { RemoveEntryOptions } from './remove-entry'
export type { RemoveSectionOptions } from './remove-section'
export type { EntryTransformer, SectionTransformer, ItemTransformer } from './transform'
export { addEntry, addUnreleasedEntry, releaseUnreleased } from './add-entry'
export { addItemToEntry } from './add-item'
export {
  filterEntries,
  filterBreakingChanges,
  filterSections,
  filterSectionTypes,
  filterItems,
  filterByScope,
  excludeByScope,
} from './filter-by-predicate'
export {
  filterByVersionRange,
  filterFromVersion,
  filterToVersion,
  filterVersionRange,
  filterRecentEntries,
  filterByDateRange,
} from './filter-by-range'
export { mergeChangelogs, appendChangelog, combineChangelogs, DEFAULT_MERGE_OPTIONS } from './merge'
export { removeEntry, removeEntries, removeUnreleased } from './remove-entry'
export { removeSection, removeItem, removeEmptySections, removeEmptyEntries } from './remove-section'
export {
  transformEntries,
  transformSections,
  transformItems,
  updateHeader,
  updateMetadata,
  updateEntry,
  sortEntries,
  sortEntriesByDate,
  reverseEntries,
  sortSections,
  normalizeSectionHeadings,
  deduplicateItems,
  compact,
  stripMetadata,
  cloneChangelog,
} from './transform'
