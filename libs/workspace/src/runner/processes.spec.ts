import type { Mock } from '@hyperfrontend/testing'
import type { ListedProcess, ProcessSources } from './processes'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { afterEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { descendantsOf, parseProcessListing, processSources, readStatus, runningProcesses, stopTargets } from './processes'

jest.mock('node:child_process', () => ({
  ...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
  execFileSync: jest.fn(),
}))

const mockExecFileSync = execFileSync as unknown as Mock

afterEach(() => jest.resetAllMocks())

/** What `/proc` holds in a case: the status line of each entry, or the error reading it throws; an entry with no status line is not a process. */
type Proc = Readonly<Record<string, string | Error | null>>

/** How the sources of a case differ from ones that can read nothing. */
interface FakeSourcesOptions {
  /** What `/proc` holds, or the error listing it throws. */
  readonly proc?: Proc | Error
  /** What `ps` prints, or the error running it throws. */
  readonly ps?: string | Error
}

/** Sources that are all fakes. */
interface FakeSources {
  /** The sources. */
  readonly sources: ProcessSources
  /** The directories listed, in order. */
  readonly listed: string[]
  /** The files read, each with its encoding, in order. */
  readonly read: (readonly [path: string, encoding: string])[]
  /** How many times `ps` ran. */
  readonly psRuns: () => number
}

/** A shell (412), the command it started (9731), that command's worker (9732), and a process apart (500). */
const LISTING = '    1     0 init\n  412     1 sh\n 9731   412 node\n 9732  9731 node\n  500     1 cron\n'

/** The same processes as `/proc` describes them, among entries that are not processes. */
const PROC: Proc = {
  '1': '1 (init) S 0 1 1 0 -1 4194560 4000 0 0',
  '412': '412 (sh) S 1 412 412 0 -1 4194304 100 0 0',
  '9731': '9731 (node) S 412 412 412 0 -1 4194304 9000 0 0',
  '9732': '9732 (node) S 9731 412 412 0 -1 4194304 900 0 0',
  '500': '500 (cron) S 1 500 500 0 -1 4194304 10 0 0',
  self: null,
  cpuinfo: null,
  '1x': null,
}

/** The processes both describe. */
const PROCESSES: ListedProcess[] = [
  { pid: 1, parent: 0, name: 'init' },
  { pid: 412, parent: 1, name: 'sh' },
  { pid: 9731, parent: 412, name: 'node' },
  { pid: 9732, parent: 9731, name: 'node' },
  { pid: 500, parent: 1, name: 'cron' },
]

/**
 * Sources reading a `/proc` and a `ps` that are tables of the case.
 *
 * @param options - What `/proc` holds and what `ps` prints; by default neither can be read
 * @returns The sources and what they were asked
 */
function fakeSources(options: FakeSourcesOptions = {}): FakeSources {
  const { proc = createError('ENOENT: no such file or directory, scandir /proc'), ps = createError('spawnSync ps ENOENT') } = options
  const listed: string[] = []
  const read: (readonly [path: string, encoding: string])[] = []
  let psRuns = 0
  return {
    sources: {
      listDirectory: (path) => {
        listed.push(path)
        if (proc instanceof Error) throw proc
        return keys(proc)
      },
      readFile: (path, encoding) => {
        read.push([path, encoding])
        const stat = (proc as Proc)[posix.basename(posix.dirname(path))]
        if (typeof stat !== 'string') throw stat ?? createError(`ENOENT: no such file or directory, open ${path}`)
        return stat
      },
      listWithPs: () => {
        psRuns += 1
        if (ps instanceof Error) throw ps
        return ps
      },
    },
    listed,
    read,
    psRuns: () => psRuns,
  }
}

/**
 * The processes in a fixed order, since a directory lists its numeric names in an order of its own.
 *
 * @param processes - The processes as read
 * @returns The processes by ascending id
 */
function byPid(processes: readonly ListedProcess[]): ListedProcess[] {
  return [...processes].sort((a, b) => a.pid - b.pid)
}

describe('parseProcessListing', () => {
  it('reads a process id, its parent and its command from every line', () => {
    expect(parseProcessListing('1 0 init\n412 1 sh\n9731 412 node')).toEqual([
      { pid: 1, parent: 0, name: 'init' },
      { pid: 412, parent: 1, name: 'sh' },
      { pid: 9731, parent: 412, name: 'node' },
    ])
  })

  it('reads columns padded on either side', () => {
    expect(parseProcessListing('    7     1 cron  \n\t 9731 \t  412 \t node')).toEqual([
      { pid: 7, parent: 1, name: 'cron' },
      { pid: 9731, parent: 412, name: 'node' },
    ])
  })

  it('keeps the base name of a command listed as a path', () => {
    expect(parseProcessListing('412 1 /bin/sh\n9731 412 /usr/local/bin/node')).toEqual([
      { pid: 412, parent: 1, name: 'sh' },
      { pid: 9731, parent: 412, name: 'node' },
    ])
  })

  it('reads a command whose path holds spaces', () => {
    expect(
      parseProcessListing('  412     1 /Volumes/My Disk/bin/sh\n 9731   412 /Applications/Some App.app/Contents/MacOS/Some App')
    ).toEqual([
      { pid: 412, parent: 1, name: 'sh' },
      { pid: 9731, parent: 412, name: 'Some App' },
    ])
  })

  it('reads a line without a command as a process without a name', () => {
    expect(parseProcessListing('412 1\n9731 412   ')).toEqual([
      { pid: 412, parent: 1, name: '' },
      { pid: 9731, parent: 412, name: '' },
    ])
  })

  it('leaves out blank lines, whichever way the lines end', () => {
    expect(parseProcessListing('\n1 0 init\r\n\r\n   \n412 1 sh\n')).toEqual([
      { pid: 1, parent: 0, name: 'init' },
      { pid: 412, parent: 1, name: 'sh' },
    ])
  })

  it.each(['PID PPID COMMAND', '412', '412 one sh', '412 1x sh', '-412 1 sh', '4.5 1 sh'])(
    'leaves out the line %j, which does not start with two numbers',
    (line) => {
      expect(parseProcessListing(`1 0 init\n${line}\n500 1 cron`)).toEqual([
        { pid: 1, parent: 0, name: 'init' },
        { pid: 500, parent: 1, name: 'cron' },
      ])
    }
  )

  it('reads nothing from an empty listing', () => {
    expect(parseProcessListing('')).toEqual([])
  })
})

describe('readStatus', () => {
  it.each([
    ['9731 (node) S 412 9731 412 0 -1 4194304 9000', { parent: 412, name: 'node' }],
    ['1 (init) S 0 1 1 0 -1', { parent: 0, name: 'init' }],
    ['9731 (sh) R 412', { parent: 412, name: 'sh' }],
    ['9731 (Web Content) S 412 9731 412 0', { parent: 412, name: 'Web Content' }],
    ['9731 (tmux: server (1)) S 412 9731 412 0', { parent: 412, name: 'tmux: server (1)' }],
    ['9731 (a) S 7 8) S 412 9731 412 0', { parent: 412, name: 'a) S 7 8' }],
    ['9731 ()) Z 412 9731\n', { parent: 412, name: ')' }],
  ])('reads %j as %j', (stat, status) => {
    expect(readStatus(stat)).toEqual(status)
  })

  it.each(['', '9731 (node) S', '9731 (node) S x 412', '9731 node S 412 9731', '9731 (node)S 412'])('reads nothing from %j', (stat) => {
    expect(readStatus(stat)).toBeNull()
  })
})

describe('descendantsOf', () => {
  it('finds the processes a process started', () => {
    expect(descendantsOf(9731, PROCESSES)).toEqual([9732])
  })

  it('finds the processes those started in turn, the nearest first', () => {
    expect(descendantsOf(412, PROCESSES)).toEqual([9731, 9732])
  })

  it('finds every child of a process with several', () => {
    expect(descendantsOf(1, PROCESSES)).toEqual([412, 500, 9731, 9732])
  })

  it('finds nothing for a process that started none', () => {
    expect(descendantsOf(500, PROCESSES)).toEqual([])
  })

  it('finds nothing for a process not listed', () => {
    expect(descendantsOf(31337, PROCESSES)).toEqual([])
  })

  it('walks a process listed as its own parent once', () => {
    expect(descendantsOf(0, [{ pid: 0, parent: 0, name: 'swapper' }, ...PROCESSES])).toEqual([1, 412, 500, 9731, 9732])
  })
})

describe('stopTargets', () => {
  it('names everything a shell wrapper started, and not the wrapper', () => {
    expect(stopTargets(412, PROCESSES)).toEqual([9731, 9732])
  })

  it('names a shell wrapper alone once it has started nothing', () => {
    expect(stopTargets(412, [{ pid: 412, parent: 1, name: 'sh' }])).toEqual([412])
  })

  it('names a command that replaced its shell, and the worker it started', () => {
    expect(stopTargets(9731, PROCESSES)).toEqual([9731, 9732])
  })

  it('names a command that started nothing alone', () => {
    expect(stopTargets(500, PROCESSES)).toEqual([500])
  })

  it('takes a shell of another name for a command', () => {
    expect(stopTargets(412, [{ pid: 412, parent: 1, name: 'bash' }, ...PROCESSES.slice(2)])).toEqual([412, 9731, 9732])
  })

  it('names a process the listing does not hold alone', () => {
    expect(stopTargets(31337, PROCESSES)).toEqual([31337])
  })

  it('names the process alone when nothing could be listed', () => {
    expect(stopTargets(412, [])).toEqual([412])
  })
})

describe('processSources', () => {
  it('reads the file system and runs ps unless given other sources', () => {
    expect(processSources()).toEqual({ listDirectory: readdirSync, readFile: readFileSync, listWithPs: expect.any(Function) })
  })

  it('keeps the sources it is given', () => {
    const { sources } = fakeSources()
    expect(processSources(sources)).toEqual(sources)
  })

  it('runs ps without a shell, one option a column, the command last, unless given another way', () => {
    mockExecFileSync.mockReturnValue(LISTING)
    processSources().listWithPs()
    expect(mockExecFileSync.mock.calls).toEqual([
      ['ps', ['-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'comm='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }],
    ])
  })

  it('answers what ps printed', () => {
    mockExecFileSync.mockReturnValue(LISTING)
    expect(processSources().listWithPs()).toBe(LISTING)
  })
})

describe('runningProcesses', () => {
  describe('on linux', () => {
    it('reads the processes from /proc, without running ps', () => {
      const { sources, psRuns } = fakeSources({ proc: PROC, ps: LISTING })
      expect({ processes: byPid(runningProcesses('linux', sources)), psRuns: psRuns() }).toEqual({ processes: byPid(PROCESSES), psRuns: 0 })
    })

    it('lists /proc alone', () => {
      const { sources, listed } = fakeSources({ proc: PROC })
      runningProcesses('linux', sources)
      expect(listed).toEqual(['/proc'])
    })

    it('reads the status line of every entry named by a number, and of no other', () => {
      const { sources, read } = fakeSources({ proc: PROC })
      runningProcesses('linux', sources)
      expect([...read].sort()).toEqual(
        ['1', '412', '500', '9731', '9732'].map((pid) => [`/proc/${pid}/stat`, 'utf8'] as [string, string]).sort()
      )
    })

    it('reads the name and the parent of a command whose name holds spaces and parentheses', () => {
      const { sources } = fakeSources({ proc: { '9731': '9731 (my (odd) cmd 1) S 412 9731 412 0', '9732': '9732 (a) S 1 2) R 9731 5 6' } })
      expect(byPid(runningProcesses('linux', sources))).toEqual([
        { pid: 9731, parent: 412, name: 'my (odd) cmd 1' },
        { pid: 9732, parent: 9731, name: 'a) S 1 2' },
      ])
    })

    it('skips a process whose status line cannot be read, as one that ended since the listing', () => {
      const { sources } = fakeSources({ proc: { ...PROC, '9732': createError('ESRCH: no such process, read') } })
      expect(byPid(runningProcesses('linux', sources))).toEqual(byPid(PROCESSES.filter(({ pid }) => pid !== 9732)))
    })

    it('skips a process whose status line holds no name and parent', () => {
      const { sources } = fakeSources({ proc: { ...PROC, '500': '500 (cron' } })
      expect(byPid(runningProcesses('linux', sources))).toEqual(byPid(PROCESSES.filter(({ pid }) => pid !== 500)))
    })

    it('falls back to ps when /proc cannot be listed', () => {
      const { sources } = fakeSources({ ps: LISTING })
      expect(runningProcesses('linux', sources)).toEqual(PROCESSES)
    })

    it('falls back to ps when /proc describes no process', () => {
      const { sources } = fakeSources({ proc: { self: null }, ps: LISTING })
      expect(runningProcesses('linux', sources)).toEqual(PROCESSES)
    })

    it('finds none when neither /proc nor ps can be read', () => {
      expect(runningProcesses('linux', fakeSources().sources)).toEqual([])
    })
  })

  describe('on another POSIX platform', () => {
    it.each(['darwin', 'freebsd'])('reads the processes from ps on %s, without reading /proc', (platform) => {
      const { sources, listed } = fakeSources({ proc: { '7': '7 (other) S 1 7 7' }, ps: LISTING })
      expect({ processes: runningProcesses(platform, sources), listed }).toEqual({ processes: PROCESSES, listed: [] })
    })

    it('finds none when ps cannot be run', () => {
      expect(runningProcesses('darwin', fakeSources({ proc: PROC }).sources)).toEqual([])
    })
  })

  describe('on win32', () => {
    it('finds none, and reads neither /proc nor ps', () => {
      const { sources, listed, psRuns } = fakeSources({ proc: PROC, ps: LISTING })
      expect({ processes: runningProcesses('win32', sources), listed, psRuns: psRuns() }).toEqual({ processes: [], listed: [], psRuns: 0 })
    })
  })
})
