export type { ChangelogDiff, DiffStats, EntryDiff, SectionDiff, ItemDiff, PropertyDiff } from './diff'
export {
  isChangelogEqual,
  isHeaderEqual,
  isLinkEqual,
  isEntryEqual,
  isSectionEqual,
  isItemEqual,
  isCommitRefEqual,
  isIssueRefEqual,
  isMetadataEqual,
  haveSameVersions,
  hasVersion,
  getEntryByVersion,
} from './is-equal'
export { diffChangelogs, diffEntries, summarizeDiff } from './diff'
