import { PromptResult, select, text } from '@hyperfrontend/questions'

// note: Sentinel choice value that diverts a `select` into the manual text-entry fallback.
const MANUAL_ENTRY = '__hf_manual_entry__'

/**
 * Prompts for the feature name, rejecting empty input.
 *
 * @returns The trimmed name, or `null` when the user cancels.
 *
 * @example Asking for a feature name
 * ```typescript
 * const name = await promptFeatureName()
 * if (name === null) return
 * ```
 */
export async function promptFeatureName(): Promise<string | null> {
  const outcome = await text({
    message: 'Feature name:',
    validate: (value) => (value.trim() === '' ? 'Name must not be empty' : undefined),
  })
  return outcome.result === PromptResult.Cancelled ? null : outcome.value.trim()
}

/**
 * Prompts for the path to the feature contract file, rejecting empty input.
 *
 * @returns The trimmed contract path, or `null` when the user cancels.
 *
 * @example Asking for the contract path
 * ```typescript
 * const contract = await promptContractPath()
 * ```
 */
export async function promptContractPath(): Promise<string | null> {
  const outcome = await text({
    message: 'Contract path (e.g. ./contracts/clock.contract.json):',
    validate: (value) => (value.trim() === '' ? 'Contract path must not be empty' : undefined),
  })
  return outcome.result === PromptResult.Cancelled ? null : outcome.value.trim()
}

/**
 * Prompts for the entry file to wire the glue import into. Discovered candidates
 * are offered first; "Enter a path manually" (and the empty-candidate case) fall
 * back to a free-form text prompt.
 *
 * @param candidates - Entry-file paths surfaced by project-scope discovery.
 * @returns The chosen or typed entry path, or `null` when the user cancels.
 *
 * @example Selecting from discovered entries
 * ```typescript
 * const entry = await promptEntryFile(['src/main.ts', 'src/index.ts'])
 * ```
 */
export async function promptEntryFile(candidates: readonly string[]): Promise<string | null> {
  if (candidates.length === 0) {
    return promptManualEntry()
  }
  const outcome = await select({
    message: 'Which entry file should import the feature glue?',
    choices: [...candidates.map((path) => ({ label: path, value: path })), { label: 'Enter a path manually…', value: MANUAL_ENTRY }],
  })
  if (outcome.result === PromptResult.Cancelled) return null
  return outcome.value === MANUAL_ENTRY ? promptManualEntry() : outcome.value
}

/**
 * Prompts for a manually-typed entry-file path, rejecting empty input.
 *
 * @returns The trimmed path, or `null` when the user cancels.
 */
async function promptManualEntry(): Promise<string | null> {
  const outcome = await text({
    message: 'Path to the entry file:',
    validate: (value) => (value.trim() === '' ? 'Entry path must not be empty' : undefined),
  })
  return outcome.result === PromptResult.Cancelled ? null : outcome.value.trim()
}
