import { spec } from 'node:test/reporters'

/**
 * One event from the test runner's stream.
 */
type RunnerEvent = {
  /** What the event reports, such as `test:pass` or `test:coverage`. */
  type: string
}

/**
 * The spec reporter with Node's coverage summary held back.
 *
 * Node reports each evaluation of a module as a file of its own, so a suite that calls
 * `jest.resetModules` gets one entry per generation and a summary that counts every line
 * of the module once per evaluation. The runner prints the merged table instead, from the
 * lcov report, and printing both would show two different answers for the same run.
 *
 * @param source - The test runner's event stream.
 * @yields {string} Each chunk of rendered output.
 */
export default async function* hfReporter(source: AsyncIterable<RunnerEvent>): AsyncGenerator<string> {
  const rendered = new spec()

  const forward = (async () => {
    for await (const event of source) {
      if (event.type !== 'test:coverage') rendered.write(event)
    }
    rendered.end()
  })()

  for await (const chunk of rendered) yield chunk as string
  await forward
}
