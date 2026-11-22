import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  boundedLines,
  RELEASE_LINE_LIMIT,
  bootMessage,
  fatalBlock,
  faultFields,
  issueLines,
  listLines,
  stackFrames,
  startedLine,
  STOPPED_LINE,
  stoppingLine,
} from './run-lines'

const RELEASE = '6a602df9bd1d576e02e0b7fbd8a523e3e701da9879879b985f52fcb76f9b6c13'
const FRAME = /^ {4}at \S/
const MARKER = 'marker'

/** An error that names itself after the base constructor ran, as most subclasses do. */
class NamedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NamedError'
  }
}

/**
 * Builds an error whose members are defined as the case needs them.
 *
 * @param members - Property descriptors laid over a fresh error.
 * @returns A real `Error` that reads as the descriptors say.
 */
const errorWith = (members: PropertyDescriptorMap): Error => Object.defineProperties(new Error('original'), members)

/**
 * Builds an error whose stack is the given text, as if it had been read from the engine.
 *
 * @param message - The error's message.
 * @param stack - The whole stack text.
 * @returns A real `Error` that reads as the two texts say.
 */
const stacked = (message: string, stack: string): Error => errorWith({ message: { value: message }, stack: { value: stack } })

/**
 * Catches what a function throws.
 *
 * @param run - The function that fails.
 * @returns The thrown value.
 */
const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

/**
 * Raises a fixed error for a getter that must not be read.
 */
const refuse = (): never => {
  throw new Error('a getter that throws')
}

describe('startedLine', () => {
  it('writes the bare word for a service with no port, run from source', () => {
    expect(startedLine(undefined, null)).toBe('started\n')
  })

  it('adds the port', () => {
    expect(startedLine(8080, null)).toBe('started port=8080\n')
  })

  it('adds the release', () => {
    expect(startedLine(undefined, RELEASE)).toBe(`started release=${RELEASE}\n`)
  })

  it('writes the port ahead of the release', () => {
    expect(startedLine(65535, RELEASE)).toBe(`started port=65535 release=${RELEASE}\n`)
  })
})

describe('stoppingLine', () => {
  it.each(['SIGINT', 'SIGTERM', 'SIGBREAK'])('names the signal %s', (signal) => {
    expect(stoppingLine('signal', signal)).toBe(`stopping cause=signal signal=${signal}\n`)
  })

  it.each(['disconnect', 'fault', 'start-timeout'] as const)('names the cause %s alone', (cause) => {
    expect(stoppingLine(cause)).toBe(`stopping cause=${cause}\n`)
  })
})

describe('the stopped line', () => {
  it('is the one word and a line feed', () => {
    expect(STOPPED_LINE).toBe('stopped\n')
  })
})

describe('fatalBlock', () => {
  it('writes a cause alone as one line', () => {
    expect(fatalBlock('stop-timeout', {}, [])).toBe('fatal cause=stop-timeout\n')
  })

  it('writes the name and the code after the cause', () => {
    expect(fatalBlock('start-failed', { name: 'Error', code: 'EADDRINUSE' }, [])).toBe(
      'fatal cause=start-failed name=Error code=EADDRINUSE\n'
    )
  })

  it('writes a name with no code', () => {
    expect(fatalBlock('environment', { name: 'TypeError' }, [])).toBe('fatal cause=environment name=TypeError\n')
  })

  it('writes the signal of a forced stop', () => {
    expect(fatalBlock('forced', { signal: 'SIGINT' }, [])).toBe('fatal cause=forced signal=SIGINT\n')
  })

  it('writes each detail on a line of its own and ends with one line feed', () => {
    expect(fatalBlock('definition', {}, ['  - one.', '  - two.'])).toBe('fatal cause=definition\n  - one.\n  - two.\n')
  })
})

describe('faultFields', () => {
  it('names an error', () => {
    expect(faultFields(new Error('no'))).toEqual({ name: 'Error' })
  })

  it('names a subclass by the name it gave itself', () => {
    expect(faultFields(new NamedError('no'))).toEqual({ name: 'NamedError' })
  })

  it('answers a name that holds a space with unknown', () => {
    expect(faultFields(errorWith({ name: { value: 'admin logged in' } }))).toEqual({ name: 'unknown' })
  })

  it('answers a thrown string with unknown and no code', () => {
    expect(faultFields('EADDRINUSE')).toEqual({ name: 'unknown' })
  })

  it('takes nothing from an object that only looks like an error', () => {
    expect(faultFields({ name: 'Error', code: 'EADDRINUSE' })).toEqual({ name: 'unknown' })
  })

  it.each(['EADDRINUSE', 'ERR_INVALID_ARG_TYPE', 'E', `E${'9'.repeat(63)}`])('adds the code %s', (code) => {
    expect(faultFields(errorWith({ code: { value: code } }))).toEqual({ name: 'Error', code })
  })

  it.each(['eaddrinuse', 'E ADDR', '9LIVES', '', `E${'9'.repeat(64)}`, 'EPIPE\nfatal cause=forced'])('leaves out the code %j', (code) => {
    expect(faultFields(errorWith({ code: { value: code } }))).toEqual({ name: 'Error' })
  })

  it('leaves out a code that is a number', () => {
    expect(faultFields(errorWith({ code: { value: 11 } }))).toEqual({ name: 'Error' })
  })

  it('leaves out a code whose getter throws', () => {
    expect(faultFields(errorWith({ code: { get: refuse } }))).toEqual({ name: 'Error' })
  })
})

describe('stackFrames', () => {
  describe('gives the frames', () => {
    it('of a real error, each trimmed and indented by four spaces', () => {
      expect(stackFrames(new Error('real')).filter((frame) => !FRAME.test(frame))).toEqual([])
    })

    it('of a real error, at least one', () => {
      expect(stackFrames(new Error('real')).length).toBeGreaterThan(0)
    })

    it('of this very file first', () => {
      expect(stackFrames(new Error('real'))[0]).toContain('run-lines.spec.ts')
    })

    it('up to twelve of a deep stack', () => {
      const frames = Array.from({ length: 20 }, (_, index) => `    at deep${index} (file.js:${index}:1)`)
      expect(stackFrames(stacked('deep', ['Error: deep', ...frames].join('\n')))).toEqual(frames.slice(0, 12))
    })

    it('with whatever indentation the engine used replaced by four spaces', () => {
      expect(stackFrames(stacked('tabs', 'Error: tabs\n\tat first (a.js:1:1)\n  at second (b.js:2:2)  '))).toEqual([
        '    at first (a.js:1:1)',
        '    at second (b.js:2:2)',
      ])
    })

    it('and skips the lines between them that are not frames', () => {
      expect(stackFrames(stacked('gap', 'Error: gap\n    at first (a.js:1:1)\nat the margin\n\n    at second (b.js:2:2)'))).toEqual([
        '    at first (a.js:1:1)',
        '    at second (b.js:2:2)',
      ])
    })

    it('of a subclass that names itself after the base constructor', () => {
      expect(stackFrames(new NamedError('named')).length).toBeGreaterThan(0)
    })

    it('of an error of the platform that has a code', () => {
      expect(stackFrames(thrownBy(() => join(5 as unknown as string))).length).toBeGreaterThan(0)
    })

    it('of an error with an empty message', () => {
      expect(stackFrames(new Error('')).length).toBeGreaterThan(0)
    })

    it('of an error whose one-letter message also occurs in its name', () => {
      expect(stackFrames(new Error('r')).length).toBeGreaterThan(0)
    })

    it.each(['Error', 'Err', 'E'])('of an error whose message %j opens its own name', (message) => {
      expect(stackFrames(new Error(message)).length).toBeGreaterThan(0)
    })

    it('of an error with no name, whose stack opens with the message', () => {
      expect(stackFrames(stacked('lone', 'lone\n    at only (a.js:1:1)'))).toEqual(['    at only (a.js:1:1)'])
    })
  })

  describe('gives none', () => {
    it.each(['a thrown string', null, undefined, 7, { stack: 'Error: x\n    at f (a.js:1:1)', message: 'x' }])('for %j', (value) => {
      expect(stackFrames(value)).toEqual([])
    })

    it('for an error whose stack is not a string', () => {
      expect(stackFrames(errorWith({ stack: { value: 5 } }))).toEqual([])
    })

    it('for an error whose message is not a string', () => {
      expect(stackFrames(errorWith({ message: { value: 5 } }))).toEqual([])
    })

    it('for an error whose stack getter throws', () => {
      expect(stackFrames(errorWith({ stack: { get: refuse } }))).toEqual([])
    })

    it('for an error whose message getter throws', () => {
      expect(stackFrames(errorWith({ message: { get: refuse } }))).toEqual([])
    })

    it('for an error whose message was replaced after its stack was read', () => {
      const error = new Error('first')
      void error.stack
      error.message = 'second'
      expect(stackFrames(error)).toEqual([])
    })

    it('for an error whose message was replaced by text that opens its name', () => {
      const error = new Error('first')
      void error.stack
      error.message = 'Err'
      expect(stackFrames(error)).toEqual([])
    })

    it('for a stack that holds the message only below its first line', () => {
      expect(stackFrames(stacked('late', 'Error: early\n    at f (a.js: late\n    at g (b.js:1:1)'))).toEqual([])
    })

    it('for a stack whose header goes on after the message', () => {
      expect(stackFrames(stacked('fir', 'Error: first\n    at f (a.js:1:1)'))).toEqual([])
    })

    it('for a stack that is its header alone', () => {
      expect(stackFrames(stacked('only', 'Error: only'))).toEqual([])
    })

    it('for a stack that is one line and a message that is empty', () => {
      expect(stackFrames(stacked('', 'Error'))).toEqual([])
    })
  })

  describe('keeps a message out of the frames', () => {
    it('when its second line is shaped like a frame', () => {
      expect(stackFrames(new Error(`first line\n    at ${MARKER} (evil:1:1)`)).filter((frame) => frame.includes(MARKER))).toEqual([])
    })

    it('and still gives the real frames of that error', () => {
      expect(stackFrames(new Error(`first line\n    at ${MARKER} (evil:1:1)`))[0]).toContain('run-lines.spec.ts')
    })

    it('when a subclass with a code carries such a message', () => {
      const error = Object.assign(new NamedError(`first line\n    at ${MARKER} (evil:1:1)`), { code: 'E_MARKED' })
      expect(stackFrames(error).filter((frame) => frame.includes(MARKER))).toEqual([])
    })

    it('when the engine quotes text it could not parse', () => {
      const error = thrownBy(() => JSON.parse(`{"a": \n    at ${MARKER} (evil:1:1)`))
      expect(stackFrames(error).filter((frame) => frame.includes(MARKER))).toEqual([])
    })

    it('and still gives the real frames of a parse failure', () => {
      const error = thrownBy(() => JSON.parse(`{"a": \n    at ${MARKER} (evil:1:1)`))
      expect(stackFrames(error).length).toBeGreaterThan(0)
    })
  })
})

describe('bootMessage', () => {
  it('gives the message of an error', () => {
    expect(bootMessage(new Error('Invalid service options:'))).toEqual(['Invalid service options:'])
  })

  it('keeps a message of several lines as it is', () => {
    expect(bootMessage(new Error('Invalid service options:\n  - "port" must be an integer.'))).toEqual([
      'Invalid service options:\n  - "port" must be an integer.',
    ])
  })

  it('gives nothing for an empty message', () => {
    expect(bootMessage(new Error(''))).toEqual([])
  })

  it('gives nothing for a message that is not a string', () => {
    expect(bootMessage(errorWith({ message: { value: 5 } }))).toEqual([])
  })

  it('gives nothing for a message whose getter throws', () => {
    expect(bootMessage(errorWith({ message: { get: refuse } }))).toEqual([])
  })

  it.each(['a thrown string', null, undefined, { message: 'looks like one' }])('gives nothing for %j, which is no error', (value) => {
    expect(bootMessage(value)).toEqual([])
  })
})

describe('issueLines', () => {
  it('writes one line per issue, with the name, the group, the problem and what was expected', () => {
    expect(
      issueLines([
        { name: 'PORT', group: 'http', problem: 'malformed', expected: 'an integer between 0 and 65535' },
        { name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' },
      ])
    ).toEqual([
      '  - PORT (http) is malformed; expected an integer between 0 and 65535.',
      '  - HELLO_GREETING (hello) is missing; expected non-empty text.',
    ])
  })

  it('writes nothing for no issue', () => {
    expect(issueLines([])).toEqual([])
  })
})

describe('boundedLines', () => {
  const lines = (count: number): readonly string[] => Array.from({ length: count }, (_, index) => `  - line ${index}`)

  it('prints at most 32 lines of a release block', () => {
    expect(RELEASE_LINE_LIMIT).toBe(32)
  })

  it('gives the lines as they are when they fit the limit', () => {
    expect(boundedLines(lines(32))).toEqual(lines(32))
  })

  it('gives the first lines up to the limit and one line that counts the rest', () => {
    expect(boundedLines(lines(40))).toEqual([...lines(32), '  - and 8 more.'])
  })
})

describe('listLines', () => {
  it('writes each sentence as a list item', () => {
    expect(listLines(['"start" must be a function.', 'the build stamp is malformed.'])).toEqual([
      '  - "start" must be a function.',
      '  - the build stamp is malformed.',
    ])
  })
})
