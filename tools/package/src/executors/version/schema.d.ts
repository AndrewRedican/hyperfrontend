/**
 * Options for the idempotent version executor.
 * Pass-through to \@jscutlery/semver:version with idempotency checks.
 */
export interface VersionExecutorOptions {
  /** See what commands would be run, without committing to git or updating files. */
  dryRun?: boolean

  /** Bypass pre-commit or commit-msg git hooks during the commit phase. */
  noVerify?: boolean

  /** Pushes to the git remote. */
  push?: boolean

  /** Pushes against git remote repository. */
  remote?: string

  /** Pushes against git base branch. */
  baseBranch?: string

  /** Manually increment the version by that keyword. */
  releaseAs?: string

  /** Use the next semantic prerelease version with a specific prerelease identifier. */
  preid?: string

  /** Version tag prefix. Default is '{projectName}@' in independent mode. */
  tagPrefix?: string

  /** Specify the targets to run after a new version was successfully created. */
  postTargets?: string[]

  /** Includes the project's dependencies in calculating a recommended version bump. */
  trackDeps?: boolean

  /** Allow bumping versions even if there are no changes in the library. */
  allowEmptyRelease?: boolean

  /** Allows to skip making a commit when bumping a version. */
  skipCommit?: boolean

  /** Allows to skip tagging the release. */
  skipTag?: boolean

  /** Customize Conventional Changelog generation. */
  preset?: string

  /** Generates changelog with custom header. */
  changelogHeader?: string

  /** A string to be used to format the auto-generated release commit message. */
  commitMessageFormat?: string

  /** Specify array of commit types to be ignored when calculating next version bump. */
  skipCommitTypes?: string[]
}
