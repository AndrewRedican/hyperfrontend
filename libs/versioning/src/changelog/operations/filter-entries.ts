/**
 * Changelog Entry Filtering
 *
 * Re-exports from split files for backward compatibility.
 */

// Predicate-based filtering
export type { EntryPredicate, SectionPredicate, ItemPredicate } from './filter-by-predicate'
export {
  filterEntries,
  filterBreakingChanges,
  filterSections,
  filterSectionTypes,
  filterItems,
  filterByScope,
  excludeByScope,
} from './filter-by-predicate'

// Range-based filtering
export {
  filterByVersionRange,
  filterFromVersion,
  filterToVersion,
  filterVersionRange,
  filterRecentEntries,
  filterByDateRange,
} from './filter-by-range'
