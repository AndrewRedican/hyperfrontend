/**
 * The consumer projects the suites run the installed package against, held as text: each maps
 * a path below the project root to the file's contents.
 *
 * - `project`: sources with specs, an unloaded file, a module mapped to a stub and a setup module
 * - `jest-style`: suites written the way a Jest user writes them
 * - `failing`: a suite that fails on purpose
 * - `dom`: a suite that needs a document
 */
export const CONSUMER_SOURCES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  dom: {
    'src/dom.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'

describe('the DOM preload', () => {
  it('puts a document on the global', () => {
    expect(typeof document).toBe('object')
    expect(document.createElement('div').tagName).toBe('DIV')
  })

  it('makes window the global object, the way a browser does', () => {
    expect(globalThis.window).toBe(globalThis)
    expect(window.document).toBe(document)
  })

  it('keeps the realm intrinsics rather than the window copies', () => {
    expect([].constructor).toBe(Array)
  })
})
`,
  },
  failing: {
    'src/failing.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'

describe('a suite that fails on purpose', () => {
  it('fails a matcher', () => {
    expect(1 + 1).toBe(3)
  })

  it('declares an assertion it never makes', () => {
    expect.assertions(1)
  })

  it('passes, so the run is not all failures', () => {
    expect(true).toBe(true)
  })
})
`,
  },
  'jest-style': {
    'src/automock.spec.ts': `import { spawnSync } from 'node:child_process'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { nodeStatus } from './shell'

jest.mock('node:child_process')

describe('jest.mock automock of a built-in', () => {
  it('turns the named export into a mock function', () => {
    expect(jest.mocked(spawnSync).mock.calls).toEqual([])
  })

  it('hands the configured return value to the code under test', () => {
    jest.mocked(spawnSync).mockReturnValue({ status: 7 } as ReturnType<typeof spawnSync>)
    expect(nodeStatus()).toBe(7)
    expect(spawnSync).toHaveBeenCalledWith(process.execPath, ['--version'])
  })
})
`,
    'src/do-mock.spec.ts': `import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { flavour } from './flavour'

describe('jest.doMock after jest.resetModules', () => {
  it('serves the replacement to a dynamic import made after it', async () => {
    expect(flavour()).toBe('vanilla')

    jest.resetModules()
    jest.doMock('./flavour', () => ({ flavour: () => 'chocolate' }))
    const fresh = await import('./flavour')

    expect(fresh.flavour()).toBe('chocolate')
    expect(flavour()).toBe('vanilla')
  })
})
`,
    'src/each.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'

describe('it.each', () => {
  it.each([
    [1, 2, 3],
    [2, 3, 5],
  ])('adds %s and %s to make %p', (left: number, right: number, sum: number) => {
    expect.assertions(1)
    expect(left + right).toBe(sum)
  })

  it.each([['ab', 'cd', 'abcd']])('joins %s and %s into %p', (left: string, right: string, joined: string) => {
    expect(left + right).toBe(joined)
  })

  it('accepts the assertion count a test declares', () => {
    expect.assertions(2)
    expect(1).toBe(1)
    expect(2).toBe(2)
  })

  it('accepts a test that declares it asserts at all', () => {
    expect.hasAssertions()
    expect('yes').toBeDefined()
  })
})
`,
    'src/flavour.ts': `/**
 * The module a spec replaces at runtime with \`jest.doMock\`.
 *
 * @returns The real flavour.
 */
export function flavour(): string {
  return 'vanilla'
}
`,
    'src/greeting.ts': `import { label, untouched } from './label'

/**
 * Reads both exports of the module a spec replaces, so the replacement is observed from
 * a consumer rather than only from the spec's own import.
 *
 * @returns The label and the untouched value, joined.
 */
export function greet(): string {
  return \`\${label()}/\${untouched()}\`
}
`,
    'src/label.ts': `/**
 * The export a spec replaces through \`jest.mock\`.
 *
 * @returns The real label.
 */
export function label(): string {
  return 'real'
}

/**
 * The export a partial mock leaves alone.
 *
 * @returns The real value.
 */
export function untouched(): string {
  return 'kept'
}
`,
    'src/mock-factory.spec.ts': `import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { greet } from './greeting'
import { label, untouched } from './label'

jest.mock('./label', () => {
  const actual = jest.requireActual('./label') as typeof import('./label')
  return { label: () => \`mocked(\${actual.label()})\` }
})

describe('jest.mock with a factory', () => {
  it('replaces the export the factory names, wrapping the actual one', () => {
    expect(label()).toBe('mocked(real)')
  })

  it('keeps the export the factory leaves out real', () => {
    expect(untouched()).toBe('kept')
  })

  it('reaches a consumer of the replaced module', () => {
    expect(greet()).toBe('mocked(real)/kept')
  })
})
`,
    'src/origin.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'

describe('the runtime a fixture imports', () => {
  it('is the copy installed under the consumer project, not a workspace alias', () => {
    expect(import.meta.resolve('@hyperfrontend/testing')).toContain('/node_modules/@hyperfrontend/testing/index.mjs')
  })
})
`,
    'src/shell.ts': `import { spawnSync } from 'node:child_process'

/**
 * Runs the current Node binary, so a spec can automock \`node:child_process\` and watch
 * the call arrive on the mock instead of a real process.
 *
 * @returns The child's exit status.
 */
export function nodeStatus(): number | null {
  return spawnSync(process.execPath, ['--version']).status
}
`,
    'src/timers.spec.ts': `import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'

describe('fake timers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('advances a cascade step by step, then drains what the cascade scheduled', () => {
    const order: string[] = []
    setTimeout(() => {
      order.push('first')
      setTimeout(() => {
        order.push('second')
        setTimeout(() => order.push('third'), 30)
      }, 20)
    }, 10)

    jest.advanceTimersByTime(10)
    expect(order).toEqual(['first'])

    jest.advanceTimersByTime(20)
    expect(order).toEqual(['first', 'second'])

    jest.runAllTimers()
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('moves the clock with setSystemTime', () => {
    jest.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))
    expect(new Date().toISOString()).toBe('2026-01-02T03:04:05.000Z')
    expect(Date.now()).toBe(Date.parse('2026-01-02T03:04:05.000Z'))
  })
})
`,
  },
  project: {
    'src/extras.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'
import { twice } from './extras'

describe('extras', () => {
  it('doubles', () => {
    expect(twice(4)).toBe(8)
  })
})
`,
    'src/extras.ts': `/**
 * Doubles a number. Its spec calls it.
 *
 * @param value - The number to double.
 * @returns Twice the value.
 */
export function twice(value: number): number {
  return value * 2
}

/**
 * Never called by any spec, so the file's function coverage stays at half.
 *
 * @returns Zero.
 */
export function never(): number {
  return 0
}
`,
    'src/greeting.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'
import { greet } from './greeting'

describe('greeting', () => {
  it('sees the replacement the setup module declared, without declaring anything itself', () => {
    expect(greet()).toBe('from-setup')
  })
})
`,
    'src/greeting.ts': `import { label } from './label'

/**
 * Reads the label, so a spec sees whatever replacement is in force.
 *
 * @returns The label.
 */
export function greet(): string {
  return label()
}
`,
    'src/label.ts': `/**
 * The export the project's setup module replaces for every spec.
 *
 * @returns The real label.
 */
export function label(): string {
  return 'real'
}
`,
    'src/math.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'
import { add, subtract } from './math'

describe('math', () => {
  it('adds', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('subtracts', () => {
    expect(subtract(5, 3)).toBe(2)
  })
})
`,
    'src/math.ts': `/**
 * Adds two numbers.
 *
 * @param left - The first addend.
 * @param right - The second addend.
 * @returns The sum.
 */
export function add(left: number, right: number): number {
  return left + right
}

/**
 * Subtracts one number from another.
 *
 * @param left - The minuend.
 * @param right - The subtrahend.
 * @returns The difference.
 */
export function subtract(left: number, right: number): number {
  return left - right
}
`,
    'src/orphan.ts': `/**
 * Loaded by no spec at all, so a run that includes this file in coverage has to notice
 * it was never measured.
 *
 * @returns One.
 */
export function unused(): number {
  return 1
}
`,
    'src/real.spec.ts': `import { describe, expect, it } from '@hyperfrontend/testing'
import { source } from './real'

describe('moduleNameMapper', () => {
  it('sees the module the mapper redirected to', () => {
    expect(source()).toBe('stubbed')
  })
})
`,
    'src/real.ts': `/**
 * The module a \`moduleNameMapper\` entry redirects away from.
 *
 * @returns Where the value came from.
 */
export function source(): string {
  return 'real'
}
`,
    'src/stub.ts': `/**
 * The module a \`moduleNameMapper\` entry redirects to.
 *
 * @returns Where the value came from.
 */
export function source(): string {
  return 'stubbed'
}
`,
    'test.setup.ts': `import { jest } from '@hyperfrontend/testing'

jest.mock('./src/label', () => ({ label: () => 'from-setup' }))
`,
  },
}
