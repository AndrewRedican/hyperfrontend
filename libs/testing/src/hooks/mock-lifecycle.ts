import { beforeEach } from 'node:test'
import { clearAllMocks, resetAllMocks, restoreAllMocks } from '../mock/registry.ts'

/**
 * Environment variable holding the comma-separated mock lifecycle steps the runner was
 * configured with: any of `clear`, `reset` and `restore`.
 */
export const MOCK_LIFECYCLE_VAR = 'HF_TEST_MOCK_LIFECYCLE'

/**
 * Registers a hook that runs before every test in the process, putting mocks back in the
 * state Jest's `clearMocks`, `resetMocks` and `restoreMocks` options promise.
 *
 * A hook registered outside any suite attaches to the file's root, so it runs ahead of
 * every test the file declares, at any depth, and ahead of the file's own `beforeEach`
 * hooks. A reset already clears, so `clear` beside `reset` adds nothing.
 *
 * @param declared - The steps, comma-separated, as the runner serialised them.
 * @example Clearing call history before every test
 * ```bash
 * HF_TEST_MOCK_LIFECYCLE=clear node --import @hyperfrontend/testing/hooks --test src/cart.spec.ts
 * ```
 */
export function registerMockLifecycle(declared: string | undefined): void {
  if (!declared) return
  const steps = new Set(declared.split(','))
  beforeEach(() => {
    if (steps.has('reset')) resetAllMocks()
    else if (steps.has('clear')) clearAllMocks()
    if (steps.has('restore')) restoreAllMocks()
  })
}
