import { defineHooks } from '@hyperfrontend/workspace/git-hooks'

/** The script that holds a change to the size limits of the repository. */
const BINARY_BUDGET = 'tools/pipeline/scripts/check-binary-budget.mjs'

/**
 * The Git hooks of this repository: per hook, named steps that run in order, the first failure
 * ending the hook. `npm install` installs them through the root `prepare` script, and
 * `npx hf hooks run pre-push` rehearses a push without pushing. `npx hf push` runs the `push`
 * steps and then pushes. A clone leaves steps out in an untracked hooks.local.config.ts:
 * `export default defineLocalHooks({ skip: ['pipeline'] })`.
 */
export default defineHooks({
  'pre-commit': [
    {
      name: 'binary-budget',
      run: ['node', BINARY_BUDGET, '--staged', '--allow-over-budget'],
      failText: 'A staged file is over the 2,000,000-byte limit. Unstage it and keep it out of Git, or shrink it.',
    },
    { name: 'format', run: ['hf', 'format', '--write'], stageFixed: true },
  ],
  'commit-msg': [
    {
      name: 'commitlint',
      run: ['cl'],
      passArgs: true,
      failText:
        'Your commit message does not follow the standard conventional commit format. See https://www.conventionalcommits.org/en/v1.0.0/',
    },
  ],
  'pre-push': [
    {
      name: 'binary-budget',
      run: ['node', BINARY_BUDGET, '--allow-over-budget'],
      failText:
        'A commit on this branch adds a file over the 2,000,000-byte limit, which CI rejects. Drop it from the branch history before pushing.',
    },
    {
      name: 'audit',
      run: ['hf', 'run-many', '-t', 'audit', '--all'],
      failText:
        'Security audit failed. Run "npm audit" in the reported project directory to see the advisories. Fix one through package.json; when no patched release exists, record a dated exception in audit-exceptions.json.',
    },
    {
      name: 'version-check',
      run: ['hf', 'affected', '-t', 'version-check'],
      failText:
        'A library is due a version bump this branch does not carry. Push with "npx hf push", which bumps, commits and pushes in one go.',
    },
    {
      name: 'pipeline',
      // why: the same plan and prerequisite rules as CI, in three stages; a failed stage stops the run before the next starts
      run: ['node', '--import', './libs/workspace/src/hooks/index.ts', 'tools/pipeline/bin/pipeline.ts', 'run', '--local'],
      env: { CI: '1', NODE_OPTIONS: '--max-old-space-size=4096' },
      failText: 'The pipeline failed. Read the summary above; each task wrote its log under .hf/pipeline/logs.',
    },
  ],
  push: [
    {
      name: 'version',
      run: ['hf', 'run', 'hyperfrontend:version:all', '--verbose'],
      failText: 'The version batch failed, so nothing was pushed. Read the output above; the working tree is as it was before the batch.',
    },
  ],
})
