/**
 * The commands a plan task runs: a target of a project through the workspace's own command line,
 * which runs that one task and none of the tasks it needs (the plan lists those as tasks of their
 * own), and the pipeline's own tasks: the floor probe and the consumer smoke through the Node.js
 * release they are meant for, and the Railway deploy of a demo.
 *
 * @module pipeline/commands
 */

import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The targets the pipeline runs itself rather than as a target of a project. */
export const PipelineTarget = freeze({
  /** Loads every entry of a built package on the floor release it declares. */
  Probe: 'probe',
  /** Drives the packed package from a consumer on the floor release. */
  SmokeFloor: 'smoke-floor',
  /** Drives the packed package from a consumer on the newest release of the floor's major. */
  SmokeMajor: 'smoke-major',
  /** Deploys the commit to the Railway service a demo declares. */
  Deploy: 'deploy',
} as const)

/** One of the pipeline's own targets. */
export type PipelineTarget = (typeof PipelineTarget)[keyof typeof PipelineTarget]

/** The module hook that resolves the workspace's TypeScript sources and path aliases, workspace-relative. */
export const ALIAS_HOOK = './tools/lint/src/runtime/aliases.ts'

/** The workspace's own command line, workspace-relative. */
export const HF_ENTRY = 'tools/workspace/bin/hf.ts'

/** The floor probe, workspace-relative. */
export const PROBE_SCRIPT = 'tools/workspace/scripts/probe-node-floor.mjs'

/** The consumer smoke an e2e project may ship, relative to the project root. */
export const SMOKE_SCRIPT = 'scripts/consumer-smoke.mjs'

/** The Railway deploy, workspace-relative. */
export const DEPLOY_SCRIPT = 'tools/workspace/scripts/railway-deploy.mjs'

/** The position of each target inside a chain, prerequisites first. */
const TARGET_RANK: Readonly<Record<string, number>> = freeze({
  install: 0,
  typecheck: 1,
  lint: 2,
  test: 3,
  build: 4,
  e2e: 5,
  [PipelineTarget.Probe]: 6,
  [PipelineTarget.SmokeFloor]: 7,
  [PipelineTarget.SmokeMajor]: 8,
  publish: 9,
  [PipelineTarget.Deploy]: 10,
})

/**
 * The command running one target of a project on the workspace's Node.js, alone: nothing it
 * depends on runs first.
 *
 * @param id - `<project>:<target>`
 * @returns The argument vector
 */
export function taskCommand(id: string): string[] {
  return ['node', '--import', ALIAS_HOOK, HF_ENTRY, 'run', id]
}

/**
 * The command running a script on a Node.js release: the workspace's own when none is named,
 * else the named release fetched by npx.
 *
 * @param version - The release, such as `18.0.0` or `24`, or null for the workspace's Node.js
 * @param script - The script, workspace-relative
 * @returns The argument vector
 */
export function nodeCommand(version: string | null, script: string): string[] {
  return version === null ? ['node', script] : ['npx', '-y', '-p', `node@${version}`, 'node', script]
}

/**
 * The lowest Node.js release a package declares it loads on.
 *
 * @param range - The `engines.node` range, such as `>=22.18.0`
 * @returns The floor as `major.minor.patch`, or null when the package declares none
 */
export function declaredFloor(range: string | undefined): string | null {
  const trimmed = (range ?? '').trim()
  if (!trimmed.startsWith('>=')) return null
  const parts = trimmed.slice(2).trim().split('.')
  if (parts.length > 3 || parts.some((part) => part === '' || [...part].some((char) => char < '0' || char > '9'))) return null
  return `${parts[0]}.${parts[1] ?? '0'}.${parts[2] ?? '0'}`
}

/**
 * The major release of a floor.
 *
 * @param floor - A floor from `declaredFloor`
 * @returns The major, such as `24`
 */
export function majorOf(floor: string): string {
  return floor.slice(0, floor.indexOf('.'))
}

/**
 * The position of a target inside a chain.
 *
 * @param target - A target name
 * @returns Lower for a prerequisite; targets the pipeline does not order come last
 */
export function targetRank(target: string): number {
  return TARGET_RANK[target] ?? 11
}
