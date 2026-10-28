/**
 * `@hyperfrontend/workspace/graph` - the owned workspace graph: the projects, files, entries and
 * installed packages a workspace holds, the qualified edges between them, and the project edges
 * Nx would draw.
 */
export type { Closure, Fallback, Hop } from './affected/closure'
export type { ExplainMode } from './affected/explain'
export type { ConfigurationKind } from './affected/rules'
export type { SelectOptions } from './affected/select'
export type { FileFilter, ProjectInput, RoleFilter, TaskInputs } from './affected/targets'
export type { BuildOptions, WorkspaceGraph } from './build'
export type { Prerequisite } from './depends-on'
export type { ImportTable } from './imports'
export type {
  Configured,
  DependsOn,
  DependsOnObject,
  InputDefinition,
  InputObject,
  NxConfiguration,
  SettingSource,
  TargetDefaults,
} from './inputs'
export type {
  BuiltinResolution,
  ConfigNode,
  Edge,
  EdgeEvidence,
  EdgeGroup,
  EdgePath,
  EntryNode,
  ExternalNode,
  FileImport,
  FileNode,
  GraphNode,
  NpmResolution,
  NpmUse,
  PackageManifest,
  ProjectConfiguration,
  ProjectEdge,
  ProjectNode,
  ProjectRecord,
  ProjectResolution,
  Resolution,
  TargetOptions,
  TargetRecord,
  TaskRef,
  ToolNode,
  UnknownResolution,
} from './model'
export type { Resolver } from './resolve'
export type { AffectedSet, ChangeSet, FileChange, Reason, TaskDecision } from './selection'
export type { FileRecord } from './store/files'
export type { UpdatePlan } from './store/invalidate'
export type { LockOptions } from './store/lock'
export type { GraphMeta } from './store/meta'
export type { EntryClosure, GraphBody, ImportRecord, PrintableProject } from './store/serialize'
export type {
  BuildOutcome,
  BuildStateOptions,
  BuiltState,
  EntriesBody,
  FilesBody,
  ImportsBody,
  PersistedState,
  StateKey,
  StateStatus,
  Verification,
} from './store/state'
export type { Envelope } from './store/write'
export type { LintTarget, LintTargetMetadata, LintTargetOptions } from './workspace'
export { ALL_KINDS, closureOf, entryClosures, hopTo, ruleHop, traceOf } from './affected/closure'
export { describeReason, formatAffected, formatTask } from './affected/explain'
export { configurationKind, isGlobalConfig } from './affected/rules'
export { selectAffected } from './affected/select'
export { fileFilterOf, relevantKinds, roleFilterOf, taskInputs, TYPE_BLIND_TARGETS } from './affected/targets'
export { buildGraph, workspaceGraph } from './build'
export { changeSet, parseNameStatus } from './changes'
export { libraryOfE2e, prerequisitesOf } from './depends-on'
export { entriesOfProject, exportTarget } from './entries'
export { importsOfFiles, importsOfText, isCodeFile, readerVersion, readImports } from './imports'
export {
  expandInputs,
  isCompatibleTarget,
  readNxConfiguration,
  selfInputs,
  targetDefaultsFor,
  targetDependsOn,
  targetExecutor,
  targetInputs,
} from './inputs'
export { installedPackages } from './lockfile'
export { EdgeKind, ImportKind, NodeKind, nodeId, taskId } from './model'
export { compareEdges, compareText, sortEdges } from './order'
export { fileOf, packageNameOf, packagesOf, projectOfFile, resolveSpecifier, substituteWildcard } from './resolve'
export { PRODUCTION_EXCLUSIONS, Role, roleOf } from './roles'
export { ChangeStatus, ReasonRule } from './selection'
export { hashesByPath, listFileRecords } from './store/files'
export { blobHashes, canonicalJson, digestOf, sha256, sourcesHash } from './store/hashes'
export { planUpdate, UpdateMode } from './store/invalidate'
export { isStaleLock, LOCK_FILE, withLock } from './store/lock'
export { algorithmVersion, currentMeta, GLOBAL_CONFIG, metaDifferences, SCHEMA } from './store/meta'
export { readStateFile } from './store/read'
export { entriesBody, graphBody, importsBody, printableProject } from './store/serialize'
export { buildState, readState, STATE_FILES, stateDirectory, stateStatus, verifyState } from './store/state'
export { envelopeText, writeStateFile } from './store/write'
export {
  discoverProjects,
  hasTarget,
  inferLintTargets,
  LINT_ENTRY,
  lintTarget,
  listFiles,
  nxIgnores,
  readAliases,
  readJson,
} from './workspace'
