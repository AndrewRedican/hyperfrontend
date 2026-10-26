/**
 * `@hyperfrontend/workspace/graph` - the owned workspace graph: the projects, files, entries and
 * installed packages a workspace holds, the qualified edges between them, and the project edges
 * Nx would draw.
 */
export type { WorkspaceGraph } from './build'
export type { Configured, InputDefinition, InputObject, NxConfiguration, SettingSource, TargetDefaults } from './inputs'
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
  TargetRecord,
  TaskRef,
  ToolNode,
  UnknownResolution,
} from './model'
export type { Resolver } from './resolve'
export type { AffectedSet, ChangeSet, FileChange, Reason, TaskDecision } from './selection'
export { buildGraph, workspaceGraph } from './build'
export { entriesOfProject, exportTarget } from './entries'
export { importsOfFiles, importsOfText, isCodeFile, readerVersion } from './imports'
export { readNxConfiguration, selfInputs, targetExecutor, targetInputs } from './inputs'
export { installedPackages } from './lockfile'
export { EdgeKind, ImportKind, NodeKind, nodeId, taskId } from './model'
export { compareEdges, compareText, sortEdges } from './order'
export { fileOf, packageNameOf, packagesOf, projectOfFile, resolveSpecifier, substituteWildcard } from './resolve'
export { PRODUCTION_EXCLUSIONS, Role, roleOf } from './roles'
export { ChangeStatus, ReasonRule } from './selection'
export { discoverProjects, hasTarget, listFiles, readAliases, readJson } from './workspace'
