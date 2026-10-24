import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'

/** Paired terminal streams usable as `input`/`output` for any lib-questions prompt. */
export interface MockTerminal {
  /** Terminal stdin a test types into, pass as `config.input` */
  input: TtyInput & NodeJS.ReadStream
  /** Terminal stdout capturing every write, pass as `config.output` */
  output: CapturedOutput & NodeJS.WriteStream
  /** Releases both streams */
  destroy: () => void
}

/**
 * Pairs a typed-into terminal input with a captured output, typed as the Node
 * terminal streams a session config accepts.
 *
 * @returns Terminal streams with a `destroy` helper
 *
 * @example Driving a text prompt in a test
 * ```typescript
 * const term = createMockTerminal()
 * const pending = text({ message: 'Name:', input: term.input, output: term.output })
 * await term.input.sendKeys('h', 'i', Keys.Enter)
 * await pending
 * ```
 */
export function createMockTerminal(): MockTerminal {
  // why: the stand-ins implement what a prompt touches, not the whole socket surface Node's terminal stream types declare.
  const input = createTtyInput() as unknown as MockTerminal['input']
  const output = createCapturedOutput() as unknown as MockTerminal['output']

  return {
    input,
    output,
    destroy: (): void => {
      input.destroy()
      output.destroy()
    },
  }
}
