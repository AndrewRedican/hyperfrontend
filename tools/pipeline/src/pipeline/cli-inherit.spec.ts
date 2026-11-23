import type { AddressInfo } from 'node:net'
import type { Answer } from './__test-utils__/command-line'
import type { Plan, RunResults } from './model'
import { createServer } from 'node:http'
import { after as afterAll, before as beforeAll } from 'node:test'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { gitIn, LIBRARIES, runPipeline, startPipeline } from './__test-utils__/command-line'

/** The head commit the runs of the fixture name. */
const HEAD_SHA = 'a'.repeat(40)

/** The environment of a workflow run of the fixture's repository. */
const WORKFLOW = { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ATTEMPT: '1' }

/** A check-run request as the stand-in for the API saw it. */
type CheckRequest = readonly [method: string, name: string, status: string, conclusion: string | null, title: string | null]

/** The body of a check-run request, as far as it is read. */
interface CheckBody {
  /** The name, on a create. */
  readonly name?: string
  /** `in_progress` or `completed`. */
  readonly status: string
  /** The conclusion, once completed. */
  readonly conclusion?: string
  /** What the check run shows. */
  readonly output?: { readonly title: string }
}

/** What two pushes to a pull request left behind. */
interface Flow {
  /** The results of the first push's run on Linux, run 7. */
  first: RunResults
  /** What planning the second push printed. */
  planned: Answer
  /** The plan of the second push. */
  plan: Plan
  /** What the second push's run on Linux printed, run 8. */
  ran: Answer
  /** The results of that run. */
  second: RunResults
  /** The check-run requests that run sent. */
  requests: CheckRequest[]
  /** What a run of the same plan printed under `--no-inherit`. */
  asked: Answer
  /** What a run of the same plan printed after its origins were rewritten to another Node.js release. */
  declined: Answer
}

const fixture = createTempDir({ prefix: 'pipeline-cli-inherit-', tree: LIBRARIES })
const flow = {} as Flow
const api = createServer((request, response) => {
  let text = ''
  request.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')))
  request.on('end', () => {
    const body = parse(text) as CheckBody
    const name = body.name ?? `#${(request.url ?? '').split('/').pop()}`
    flow.requests.push([request.method ?? '', name, body.status, body.conclusion ?? null, body.output?.title ?? null])
    response.setHeader('content-type', 'application/json')
    response.end(stringify({ id: flow.requests.length }))
  })
})

/**
 * Reads a file the pipeline wrote in the fixture.
 *
 * @param name - The file under the pipeline's directory
 * @returns The value
 */
function written<Value>(name: string): Value {
  return fixture.readJson<Value>(`.hf/pipeline/${name}`)
}

beforeAll(async () => {
  gitIn(fixture.path, 'init', '-q', '-b', 'main')
  gitIn(fixture.path, 'add', '-A')
  gitIn(fixture.path, 'commit', '-q', '-m', 'base')
  const base = gitIn(fixture.path, 'rev-parse', 'HEAD')
  fixture.write('libs/a/src/index.ts', 'export const a = 2\n')
  fixture.write('libs/b/src/index.ts', 'export const b = 2\n')
  runPipeline(fixture.path, ['plan', '--base', base])
  runPipeline(fixture.path, ['run', '--environment', 'linux', '--head-sha', HEAD_SHA], { ...WORKFLOW, GITHUB_RUN_ID: '7' })
  flow.first = written<RunResults>('results-linux.json')
  // why: the workflow downloads the earlier run's results under the pipeline's own directory, which the tree leaves out
  fixture.write('.hf/pipeline/previous/linux/results-linux.json', flow.first)
  fixture.write('libs/a/src/index.ts', 'export const a = 3\n')
  flow.planned = runPipeline(fixture.path, ['plan', '--base', base, '--inherit-from', '.hf/pipeline/previous'])
  flow.plan = written<Plan>('plan.json')
  flow.requests = []
  await createPromise<void>((listening) => api.listen(0, '127.0.0.1', listening))
  flow.ran = await startPipeline(fixture.path, ['run', '--environment', 'linux', '--checks', '--head-sha', HEAD_SHA], {
    ...WORKFLOW,
    GITHUB_RUN_ID: '8',
    GITHUB_TOKEN: 'token',
    GITHUB_API_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
  })
  flow.second = written<RunResults>('results-linux.json')
  flow.asked = runPipeline(fixture.path, ['run', '--environment', 'linux', '--no-inherit'])
  fixture.write('.hf/pipeline/plan.json', parse(stringify(flow.plan).replaceAll(`"node":"${process.version}"`, '"node":"v0.0.1"')))
  flow.declined = runPipeline(fixture.path, ['run', '--environment', 'linux'])
})

afterAll(() => {
  api.close()
  fixture.remove()
})

/**
 * The tasks a run started.
 *
 * @param answer - What the run printed
 * @returns The ids, sorted
 */
function started(answer: Answer): string[] {
  return answer.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('▶ '))
    .map((line) => line.slice(2))
    .sort()
}

describe('pipeline plan', () => {
  it('records the tree the plan is made on', () => {
    expect(flow.plan.tested).toEqual({ tree: expect.stringMatching(/^[0-9a-f]{40}$/), head: null, base: null, merge: null })
  })

  it('records the head, the base and the merge of a pull request, and none of them for any other event', () => {
    const merged = createTempDir({ prefix: 'pipeline-cli-merge-', tree: LIBRARIES })
    try {
      gitIn(merged.path, 'init', '-q', '-b', 'main')
      gitIn(merged.path, 'add', '-A')
      gitIn(merged.path, 'commit', '-q', '-m', 'base')
      const base = gitIn(merged.path, 'rev-parse', 'HEAD')
      gitIn(merged.path, 'checkout', '-q', '-b', 'topic')
      merged.write('libs/a/src/index.ts', 'export const a = 2\n')
      gitIn(merged.path, 'commit', '-q', '-a', '-m', 'the pull request')
      const head = gitIn(merged.path, 'rev-parse', 'HEAD')
      gitIn(merged.path, 'checkout', '-q', 'main')
      gitIn(merged.path, 'merge', '-q', '--no-ff', '-m', 'merge', 'topic')
      const commits = { head, base, merge: gitIn(merged.path, 'rev-parse', 'HEAD') }
      const tested = ['pull_request', 'push'].map((event) => {
        runPipeline(merged.path, ['plan', '--base', base], { GITHUB_EVENT_NAME: event })
        return merged.readJson<Plan>('.hf/pipeline/plan.json').tested
      })
      expect(tested).toEqual([
        { tree: expect.stringMatching(/^[0-9a-f]{40}$/), ...commits },
        { tree: expect.stringMatching(/^[0-9a-f]{40}$/), head: null, base: null, merge: null },
      ])
    } finally {
      merged.remove()
    }
  })

  it('refuses --inherit-from on a plan that runs everything', () => {
    const refused = runPipeline(fixture.path, ['plan', '--all', '--inherit-from', '.hf/pipeline/previous'])
    expect({ status: refused.status, said: refused.stderr.includes('--inherit-from cannot be combined with --main or --all') }).toEqual({
      status: 1,
      said: true,
    })
  })
})

describe('pipeline run, the first run of a pull request', () => {
  it('records the tree, the run and the Node.js release with the results', () => {
    expect({ tested: flow.first.tested, run: flow.first.run, node: flow.first.node }).toEqual({
      tested: { tree: expect.stringMatching(/^[0-9a-f]{40}$/), head: null, base: null, merge: null },
      run: { id: 7, attempt: 1, sha: HEAD_SHA, url: 'https://github.com/o/r/actions/runs/7' },
      node: process.version,
    })
  })
})

describe('pipeline plan --inherit-from', () => {
  it('marks on Linux the tasks the change since the earlier run leaves out, and no task of an environment without earlier results', () => {
    expect(
      flow.plan.chains.map(
        (chain) =>
          `${chain.environment} ${chain.project}: ${chain.tasks.map((task) => `${task.target}${task.inherited === undefined ? '' : ' (inherited)'}`).join(', ')}`
      )
    ).toEqual([
      'linux lib-a: lint, test, build',
      'macos lib-a: lint, test, build',
      'windows lib-a: lint, test, build',
      'linux lib-b: lint (inherited), build (inherited)',
      'macos lib-b: lint, build',
      'windows lib-b: lint, build',
    ])
  })

  it('names in each mark the run, the tree and the end of the task it comes from', () => {
    const marked = flow.plan.chains.flatMap((chain) => chain.tasks).find((task) => task.inherited !== undefined)
    expect(marked?.inherited).toEqual({
      run: 7,
      attempt: 1,
      sha: HEAD_SHA,
      url: 'https://github.com/o/r/actions/runs/7',
      tree: flow.first.tested?.tree,
      node: process.version,
      endedAt: flow.first.tasks.find((task) => task.id === marked?.id)?.endedAt,
    })
  })

  it('says which environments inherit nothing, and how much runs and inherits', () => {
    expect(flow.planned.stdout.split(/\r?\n/)).toEqual(
      expect.arrayContaining([
        'nothing is inherited on windows: no earlier run left results that name the tree they stand on',
        'nothing is inherited on macos: no earlier run left results that name the tree they stand on',
        '13 tasks run, 2 inherited from run 7. A task marked ↩️ keeps the outcome of that earlier run.',
      ])
    )
  })
})

describe('pipeline run, with a plan that inherits', () => {
  it('starts the tasks without a mark alone', () => {
    expect(started(flow.ran)).toEqual(['lib-a:build', 'lib-a:lint', 'lib-a:test'])
  })

  it('succeeds, counting the inherited tasks apart', () => {
    expect({
      status: flow.ran.status,
      totals: flow.ran.stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith('5 tasks'))
        ?.split(', wall')[0],
    }).toEqual({
      status: 0,
      totals: '5 tasks (3 success, 2 inherited)',
    })
  })

  it('records every task of the environment, the inherited ones with the origin the plan gave them, under its own run', () => {
    expect({
      run: flow.second.run?.id,
      tasks: flow.second.tasks.map((task) => [task.id, task.outcome, task.inherited?.run ?? null, task.log === null]),
    }).toEqual({
      run: 8,
      tasks: [
        ['lib-a:lint', 'success', null, false],
        ['lib-a:test', 'success', null, false],
        ['lib-a:build', 'success', null, false],
        ['lib-b:lint', 'success', 7, true],
        ['lib-b:build', 'success', 7, true],
      ],
    })
  })

  it('creates the check run of the chain inherited whole already completed, and completes the other as its tasks end', () => {
    expect(flow.requests.filter(([method, , status]) => method === 'POST' || status === 'completed')).toEqual(
      expect.arrayContaining([
        ['POST', 'lib-b (linux)', 'completed', 'success', '2 tasks inherited from run 7'],
        ['POST', 'lib-a (linux)', 'in_progress', null, null],
        ['PATCH', expect.stringMatching(/^#\d+$/), 'completed', 'success', '3 tasks, success'],
      ])
    )
  })

  it('clears the marks of its environment and runs every task under --no-inherit', () => {
    expect({ said: flow.asked.stdout.split(/\r?\n/)[0], started: started(flow.asked) }).toEqual({
      said: 'nothing is inherited on linux: every task was asked to run',
      started: ['lib-a:build', 'lib-a:lint', 'lib-a:test', 'lib-b:build', 'lib-b:lint'],
    })
  })

  it('declines the marks of its environment when they are from another Node.js release, and runs every task', () => {
    expect({
      said: flow.declined.stdout.split(/\r?\n/)[0],
      started: started(flow.declined),
    }).toEqual({
      said: `nothing is inherited on linux: its proofs are from Node.js v0.0.1 and this run is on ${process.version}`,
      started: ['lib-a:build', 'lib-a:lint', 'lib-a:test', 'lib-b:build', 'lib-b:lint'],
    })
  })
})
