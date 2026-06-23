/**
 * Type definitions for builder configuration, context, and results.
 *
 * @module @hyperfrontend/builder/models
 */
export type {
  AssetConditionPredicate,
  AssetSpec,
  BinConfig,
  BinFormatSpec,
  BinScriptFormat,
  BuildConfig,
  BundleAllDepsOptions,
  CjsConfig,
  EsmConfig,
  FormatEntryConfig,
  IifeConfig,
  InheritFromSpec,
  IsWorkspacePackagePredicate,
  MemoryMonitorOptions,
  SeaConfig,
  SeaPlatform,
  UmdConfig,
  WorkspaceDepHoistPolicy,
} from './build-config'
export type { BuildContext, WorkspaceBundledDep } from './build-context'
export type { BinOutput, BuildResult, FormatCounts } from './build-result'
export type { EntryPoint, EntryPointCategory, EntryPointDiscovery, EntryPointPlatform } from './entry-point'
export type { FormatOutputs, IifeOutput, UmdOutput } from './format-output'
export type { AuthorField, BugsField, ConditionalExport, ExportValue, FundingField, PackageJson, RepositoryField } from './package-json'
