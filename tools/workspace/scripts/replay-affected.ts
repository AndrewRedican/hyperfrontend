/**
 * Replays the newest merges of a branch and records Nx's selection for each, as the baseline
 * the owned affected analysis is compared against. Usage, from the workspace root:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/scripts/replay-affected.ts`.
 *
 * @module scripts/replay-affected
 */

import { parseArgs } from 'node:util'
import { nxRunner } from '@hyperfrontend/integration-nx/adapters'
import { DEFAULT_TARGETS, captureBaseline } from '../src/baseline/capture'
import { git, replayMerges } from '../src/baseline/replay'

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '10' },
    ref: { type: 'string', default: 'origin/main' },
    targets: { type: 'string', default: DEFAULT_TARGETS.join(',') },
    out: { type: 'string', default: '.hf/replay' },
  },
})

const cwd = git(process.cwd(), ['rev-parse', '--show-toplevel'])
const targets = values.targets.split(',')
const records = replayMerges({
  cwd,
  ref: values.ref,
  count: Number(values.count),
  outDir: values.out,
  capture: (checkout, base, head) => captureBaseline({ base, head, targets, run: nxRunner(checkout) }),
  report: (line) => process.stdout.write(`${line}\n`),
})
process.stdout.write(`${records.length} merge${records.length === 1 ? '' : 's'} recorded under ${values.out}\n`)
