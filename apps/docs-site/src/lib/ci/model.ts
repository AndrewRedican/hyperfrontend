/** What produced an edge of the workspace graph. */
export type EdgeKind =
  | 'value'
  | 'type'
  | 'side-effect'
  | 're-export-all'
  | 'dynamic'
  | 'unresolved'
  | 'manifest'
  | 'declared'
  | 'tool'
  | 'config'

/** The role a file plays in its project. */
export type Role = 'production' | 'spec' | 'test-config' | 'lint-config' | 'build-config' | 'script' | 'docs' | 'asset'

/** A project of the workspace. */
export interface ExplorerProject {
  /** The project's name */
  name: string
  /** Its root, workspace-relative */
  root: string
  /** Its type */
  type: 'lib' | 'app' | 'e2e'
  /** Its tags */
  tags: string[]
  /** Projects it declares as dependencies */
  implicitDependencies: string[]
  /** How many files it has */
  files: number
}

/** One file behind a link. */
export interface ExplorerFile {
  /** The file, workspace-relative */
  file: string
  /** The line the edge was drawn at, or null for a configuration edge */
  line: number | null
  /** The specifier as written, or null */
  specifier: string | null
}

/** Every edge from one project to one node of one kind and role, folded. */
export interface ExplorerLink {
  /** The depending project */
  source: string
  /** `project:<name>`, `entry:<id>`, `external:<name>@<version>`, `tool:<id>` or `config:<path>` */
  target: string
  /** What produced the edges */
  kind: EdgeKind
  /** The role of the files that drew them */
  role: Role
  /** The files behind the link */
  files: ExplorerFile[]
}

/** An entry point a project exposes. */
export interface ExplorerEntry {
  /** `<package>` or `<package>/<subpath>` */
  id: string
  /** The project owning it */
  project: string
}

/** An installed package some project reaches. */
export interface ExplorerExternal {
  /** The package name */
  name: string
  /** The installed version, or null */
  version: string | null
}

/** A tool a target runs. */
export interface ExplorerTool {
  /** The executor or command */
  id: string
  /** The project implementing it, or null for an installed tool */
  project: string | null
}

/** The document the dependency explorer draws. */
export interface ExplorerDocument {
  /** The schema */
  schema: 1
  /** The commit the graph was built from */
  sha: string
  /** When the document was written, epoch milliseconds */
  generatedAt: number
  /** The projects */
  projects: ExplorerProject[]
  /** The entries, with the project owning each */
  entries: ExplorerEntry[]
  /** The packages some link reaches */
  externals: ExplorerExternal[]
  /** The tools some link reaches */
  tools: ExplorerTool[]
  /** The configuration files some link reaches */
  configs: string[]
  /** The links */
  links: ExplorerLink[]
}

/** Where a task runs. */
export type Environment = 'linux' | 'windows'

/** How much of a runner a task occupies. */
export type Weight = 'light' | 'heavy'

/** What a run of a task ended as. */
export type Outcome = 'success' | 'failure' | 'skipped' | 'cancelled'

/** Why a task is in the plan. */
export interface PlanReason {
  /** The rule that fired */
  rule: string
  /** The changed file the reason starts from, or null */
  file: string | null
  /** The edges followed, as ids */
  path: string[]
  /** One sentence for a reader */
  message: string
}

/** One task of a plan. */
export interface PlanTask {
  /** `<project>:<target>` */
  id: string
  /** The chain's project */
  project: string
  /** The target */
  target: string
  /** Where the task runs */
  environment: Environment
  /** The tasks of the same environment that must succeed first */
  needs: string[]
  /** The slot the task occupies */
  weight: Weight
  /** Why the task is in the plan */
  reasons: PlanReason[]
}

/** One project on one environment. */
export interface Chain {
  /** The project */
  project: string
  /** Where the chain runs */
  environment: Environment
  /** The rank the scheduler serves it in */
  order: number
  /** The tasks, prerequisites first */
  tasks: PlanTask[]
}

/** A task of a requested target the plan left out. */
export interface SkippedTask {
  /** The task id */
  task: string
  /** Why it was safe to leave out */
  reasons: PlanReason[]
}

/** A plan. */
export interface Plan {
  /** The base revision, or `all` */
  base: string
  /** The head revision, or null for the working tree */
  head: string | null
  /** Whether the plan was selected or runs everything */
  mode: 'affected' | 'all'
  /** Whether the plan publishes */
  main: boolean
  /** The chains, in scheduling order */
  chains: Chain[]
  /** The tasks the selection skipped, with the reasons */
  skipped: SkippedTask[]
  /** The environments with chains */
  environments: Environment[]
}

/** What one task's run ended as. */
export interface TaskResult {
  /** The task id */
  id: string
  /** The chain's project */
  project: string
  /** The target */
  target: string
  /** Where the task ran */
  environment: Environment
  /** What happened */
  outcome: Outcome
  /** The exit code, or null */
  exitCode: number | null
  /** Why the task was skipped or cancelled, or null */
  detail: string | null
  /** When the task started, epoch milliseconds, or null */
  startedAt: number | null
  /** When the task ended, epoch milliseconds, or null */
  endedAt: number | null
  /** How long the task ran */
  durationMs: number
}

/** The results of one environment's run. */
export interface RunResults {
  /** The environment */
  environment: Environment
  /** When the run started, epoch milliseconds */
  startedAt: number
  /** When the run ended or was last written */
  endedAt: number
  /** The wall-clock so far */
  durationMs: number
  /** Whether the run ended */
  complete: boolean
  /** The tasks that ended */
  tasks: TaskResult[]
}

/** Which workflow run a record is of. */
export interface RunIdentity {
  /** The run id */
  id: number
  /** The run number */
  number: number
  /** The attempt */
  attempt: number
  /** The commit */
  sha: string
  /** The ref */
  ref: string
  /** The event */
  event: string
  /** The run's page */
  url: string
}

/** The record of one run. */
export interface RunRecord {
  /** The schema */
  schema: 1
  /** Which run */
  run: RunIdentity
  /** When the record was written */
  recordedAt: number
  /** The plan */
  plan: Plan
  /** Each environment's results, when uploaded */
  results: Partial<Record<Environment, RunResults>>
}

/** What a run ended as, over every environment. */
export type RunOutcome = 'success' | 'failure' | 'cancelled' | 'incomplete'

/** One run as the index lists it. */
export interface RunIndexEntry extends RunIdentity {
  /** When the record was written */
  recordedAt: number
  /** Whether the plan was selected or ran everything */
  mode: 'affected' | 'all'
  /** Whether the plan published */
  main: boolean
  /** The environments with chains */
  environments: Environment[]
  /** How many chains */
  chains: number
  /** How many tasks */
  tasks: number
  /** What the run ended as */
  outcome: RunOutcome
}

/** The index of the records. */
export interface RunIndex {
  /** The schema */
  schema: 1
  /** The runs, newest first */
  runs: RunIndexEntry[]
}

/** A task of the compact plan. */
export interface CompactTask {
  /** The task id */
  id: string
  /** The target */
  target: string
  /** The slot it occupies */
  weight: Weight
  /** The tasks that must succeed first; empty when the plan was truncated */
  needs: string[]
}

/** A chain of the compact plan. */
export interface CompactChain {
  /** The project */
  project: string
  /** Where it runs */
  environment: Environment
  /** Its scheduling rank */
  order: number
  /** Its tasks, prerequisites first */
  tasks: CompactTask[]
}

/** The plan without its reasons, as the `pipeline plan` check run carries it. */
export interface CompactPlan {
  /** The schema */
  schema: 1
  /** The base revision */
  base: string
  /** The head revision */
  head: string | null
  /** Whether the plan was selected or runs everything */
  mode: 'affected' | 'all'
  /** Whether the plan publishes */
  main: boolean
  /** The environments with chains */
  environments: Environment[]
  /** The chains */
  chains: CompactChain[]
  /** How many tasks the plan skipped */
  skipped: number
  /** Whether the needs were dropped to fit */
  truncated: boolean
}

/** One ended task as a chain's check run carries it. */
export interface ChainTaskState {
  /** The task id */
  id: string
  /** What happened */
  outcome: Outcome
  /** The exit code, or null */
  exitCode: number | null
  /** Why it was skipped or cancelled, or null */
  detail: string | null
  /** When it started, or null */
  startedAt: number | null
  /** When it ended, or null */
  endedAt: number | null
}

/** A chain's state as its check run carries it. */
export interface ChainState {
  /** The schema */
  schema: 1
  /** The project */
  project: string
  /** The environment */
  environment: Environment
  /** How many tasks the chain has */
  total: number
  /** The tasks that ended */
  tasks: ChainTaskState[]
}

/** A workflow run as the GitHub API lists it. */
export interface GitHubRun {
  /** The run id */
  id: number
  /** The run number */
  run_number: number
  /** The attempt */
  run_attempt: number
  /** The workflow file, such as `.github/workflows/ci-main.yml` */
  path: string
  /** The commit */
  head_sha: string
  /** The branch */
  head_branch: string | null
  /** The event */
  event: string
  /** `queued`, `in_progress` or `completed` */
  status: string | null
  /** The conclusion once completed */
  conclusion: string | null
  /** The run's page */
  html_url: string
  /** When it was created */
  created_at: string
  /** When it was last updated */
  updated_at: string
  /** The title GitHub shows */
  display_title: string
}

/** A check run as the GitHub API lists it. */
export interface GitHubCheckRun {
  /** The id */
  id: number
  /** The name */
  name: string
  /** `queued`, `in_progress` or `completed` */
  status: string
  /** The conclusion once completed */
  conclusion: string | null
  /** When it started */
  started_at: string | null
  /** When it completed */
  completed_at: string | null
  /** Its page */
  html_url: string | null
  /** What it shows */
  output: CheckRunOutput
}

/** What a check run shows. */
export interface CheckRunOutput {
  /** The title */
  title: string | null
  /** The Markdown summary */
  summary: string | null
  /** The text, machine-readable here */
  text: string | null
}

/** One page of a commit's check runs. */
export interface CheckRunsPage {
  /** How many check runs the commit has, across every page */
  total_count: number
  /** The check runs */
  check_runs: GitHubCheckRun[]
}

/** One page of a run's jobs. */
export interface JobsPage {
  /** The jobs */
  jobs: GitHubJob[]
}

/** One page of a repository's workflow runs. */
export interface RunsPage {
  /** The runs */
  workflow_runs: GitHubRun[]
}

/** A job as the GitHub API lists it. */
export interface GitHubJob {
  /** The id */
  id: number
  /** The name */
  name: string
  /** `queued`, `in_progress` or `completed` */
  status: string
  /** The conclusion once completed */
  conclusion: string | null
  /** When it started */
  started_at: string | null
  /** When it completed */
  completed_at: string | null
  /** Its page */
  html_url: string | null
}
