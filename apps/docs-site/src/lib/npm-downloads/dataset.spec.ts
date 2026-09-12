import type { DatasetIo } from './dataset'
import type { DailyDownloads, DatasetManifest } from './model'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertContiguous, commitDataset, FILE_SYSTEM_IO, mergeRecords, readDataset, recordsFileFor } from './dataset'
import { NpmStatsError } from './model'

const PACKAGE = '@hyperfrontend/features'

/**
 * A run of consecutive days for one package.
 *
 * @param packageName - The package the records belong to
 * @param first - The first day, as a day of September 2026
 * @param counts - One count per day
 * @returns The records
 */
function run(packageName: string, first: number, counts: number[]): DailyDownloads[] {
  return counts.map((downloads, index) => ({ package: packageName, day: `2026-09-${String(first + index).padStart(2, '0')}`, downloads }))
}

const MANIFEST: DatasetManifest = {
  version: 1,
  refreshedAt: '2026-09-12T00:21:23.242Z',
  frontier: '2026-09-10',
  revalidationDays: 7,
  packages: { [PACKAGE]: { created: '2026-06-28' } },
}

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'npm-downloads-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/**
 * A file system that fails on the nth call of one operation.
 *
 * @param operation - Which operation to break
 * @param call - Which call of it, counted from one
 * @returns An io that behaves until the chosen call, then throws
 */
function interruptedIo(operation: keyof DatasetIo, call: number): DatasetIo {
  let calls = 0
  return {
    ...FILE_SYSTEM_IO,
    [operation]: (...args: [string, string]) => {
      calls += 1
      if (calls === call) throw new Error(`${operation} interrupted`)
      return (FILE_SYSTEM_IO[operation] as (...inner: [string, string]) => void)(...args)
    },
  }
}

describe('recordsFileFor', () => {
  it('drops the scope and adds the extension', () => {
    expect(recordsFileFor('@hyperfrontend/immutable-api-utils')).toBe('immutable-api-utils.ndjson')
  })
})

describe('assertContiguous', () => {
  it('accepts consecutive days of one package', () => {
    expect(() => assertContiguous(PACKAGE, run(PACKAGE, 1, [1, 2, 3]), 'f')).not.toThrow()
  })

  it('rejects a gap, telling the reader how to recover', () => {
    expect(() => assertContiguous(PACKAGE, [...run(PACKAGE, 1, [1]), ...run(PACKAGE, 3, [3])], 'features.ndjson')).toThrow(
      'features.ndjson jumps from 2026-09-01 to 2026-09-03'
    )
  })

  it('rejects a repeated day', () => {
    expect(() => assertContiguous(PACKAGE, [...run(PACKAGE, 1, [1]), ...run(PACKAGE, 1, [1])], 'f')).toThrow(NpmStatsError)
  })

  it('rejects a record for another package', () => {
    expect(() => assertContiguous(PACKAGE, run('@hyperfrontend/nexus', 1, [1]), 'f')).toThrow('holds a record for @hyperfrontend/nexus')
  })
})

describe('mergeRecords', () => {
  it('replaces a stored day with its fetched count and keeps the rest', () => {
    expect(mergeRecords(PACKAGE, run(PACKAGE, 1, [1, 2, 3]), run(PACKAGE, 3, [30, 4]))).toEqual(run(PACKAGE, 1, [1, 2, 30, 4]))
  })

  it('sorts a fetched gap into place', () => {
    expect(mergeRecords(PACKAGE, [...run(PACKAGE, 1, [1]), ...run(PACKAGE, 3, [3])], run(PACKAGE, 2, [2]))).toEqual(
      run(PACKAGE, 1, [1, 2, 3])
    )
  })

  it('refuses a merge that would leave a gap', () => {
    expect(() => mergeRecords(PACKAGE, run(PACKAGE, 1, [1]), run(PACKAGE, 4, [4]))).toThrow(NpmStatsError)
  })
})

describe('readDataset', () => {
  it('reads a missing directory as an empty dataset', () => {
    expect(readDataset(join(dir, 'missing'))).toEqual({ manifest: null, days: new Map() })
  })

  it('reads back what commitDataset wrote', () => {
    commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1, 2])]]))
    expect(readDataset(dir)).toEqual({ manifest: MANIFEST, days: new Map([[PACKAGE, run(PACKAGE, 1, [1, 2])]]) })
  })

  it('rejects a records file with a gap', () => {
    writeFileSync(
      join(dir, 'features.ndjson'),
      '{"package":"@hyperfrontend/features","day":"2026-09-01","downloads":1}\n{"package":"@hyperfrontend/features","day":"2026-09-03","downloads":1}\n'
    )
    expect(() => readDataset(dir)).toThrow('jumps from 2026-09-01 to 2026-09-03')
  })

  it('rejects a records file under the wrong name', () => {
    writeFileSync(join(dir, 'nexus.ndjson'), '{"package":"@hyperfrontend/features","day":"2026-09-01","downloads":1}\n')
    expect(() => readDataset(dir)).toThrow('belong in features.ndjson')
  })

  it('rejects a manifest from another layout version', () => {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...MANIFEST, version: 2 }))
    expect(() => readDataset(dir)).toThrow('layout version 2')
  })

  it('rejects a manifest with a malformed frontier', () => {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...MANIFEST, frontier: 'soon' }))
    expect(() => readDataset(dir)).toThrow('malformed frontier')
  })

  it('rejects a manifest with a malformed creation day', () => {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...MANIFEST, packages: { [PACKAGE]: { created: 'once' } } }))
    expect(() => readDataset(dir)).toThrow('malformed created day')
  })

  it('rejects a manifest that is not JSON', () => {
    writeFileSync(join(dir, 'manifest.json'), '{')
    expect(() => readDataset(dir)).toThrow('manifest.json is not JSON')
  })
})

describe('commitDataset', () => {
  it('writes one file per package plus the manifest', () => {
    commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]))
    expect(readdirSync(dir).sort()).toEqual(['features.ndjson', 'manifest.json'])
  })

  it('reports which files changed', () => {
    expect(commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]))).toEqual(['features.ndjson', 'manifest.json'])
  })

  it('leaves a byte-identical file untouched on a second commit', () => {
    commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]))
    expect(commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]))).toEqual([])
  })

  it('rewrites only the package whose records changed', () => {
    const nexus = '@hyperfrontend/nexus'
    commitDataset(
      dir,
      MANIFEST,
      new Map([
        [PACKAGE, run(PACKAGE, 1, [1])],
        [nexus, run(nexus, 1, [1])],
      ])
    )
    expect(
      commitDataset(
        dir,
        MANIFEST,
        new Map([
          [PACKAGE, run(PACKAGE, 1, [1])],
          [nexus, run(nexus, 1, [2])],
        ])
      )
    ).toEqual(['nexus.ndjson'])
  })

  it('leaves no temporary files behind', () => {
    commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]))
    expect(readdirSync(dir).some((file) => file.endsWith('.tmp'))).toBe(false)
  })

  it('refuses to write records with a gap', () => {
    expect(() => commitDataset(dir, MANIFEST, new Map([[PACKAGE, [...run(PACKAGE, 1, [1]), ...run(PACKAGE, 3, [3])]]]))).toThrow(
      NpmStatsError
    )
  })

  it('keeps every original when staging is interrupted', () => {
    const nexus = '@hyperfrontend/nexus'
    commitDataset(
      dir,
      MANIFEST,
      new Map([
        [PACKAGE, run(PACKAGE, 1, [1])],
        [nexus, run(nexus, 1, [1])],
      ])
    )
    expect(() =>
      commitDataset(
        dir,
        MANIFEST,
        new Map([
          [PACKAGE, run(PACKAGE, 1, [9])],
          [nexus, run(nexus, 1, [9])],
        ]),
        interruptedIo('writeFile', 2)
      )
    ).toThrow('writeFile interrupted')
    expect({
      features: readFileSync(join(dir, 'features.ndjson'), 'utf8'),
      nexus: readFileSync(join(dir, 'nexus.ndjson'), 'utf8'),
      temps: readdirSync(dir).filter((file) => file.endsWith('.tmp')),
    }).toEqual({
      features: '{"package":"@hyperfrontend/features","day":"2026-09-01","downloads":1}\n',
      nexus: '{"package":"@hyperfrontend/nexus","day":"2026-09-01","downloads":1}\n',
      temps: [],
    })
  })

  it('restores the files already renamed when a rename is interrupted', () => {
    const nexus = '@hyperfrontend/nexus'
    commitDataset(
      dir,
      MANIFEST,
      new Map([
        [PACKAGE, run(PACKAGE, 1, [1])],
        [nexus, run(nexus, 1, [1])],
      ])
    )
    expect(() =>
      commitDataset(
        dir,
        MANIFEST,
        new Map([
          [PACKAGE, run(PACKAGE, 1, [9])],
          [nexus, run(nexus, 1, [9])],
        ]),
        interruptedIo('rename', 2)
      )
    ).toThrow('rename interrupted')
    expect({
      features: readFileSync(join(dir, 'features.ndjson'), 'utf8'),
      nexus: readFileSync(join(dir, 'nexus.ndjson'), 'utf8'),
      temps: readdirSync(dir).filter((file) => file.endsWith('.tmp')),
    }).toEqual({
      features: '{"package":"@hyperfrontend/features","day":"2026-09-01","downloads":1}\n',
      nexus: '{"package":"@hyperfrontend/nexus","day":"2026-09-01","downloads":1}\n',
      temps: [],
    })
  })

  it('removes a file it had created when a rename is interrupted on a first commit', () => {
    expect(() => commitDataset(dir, MANIFEST, new Map([[PACKAGE, run(PACKAGE, 1, [1])]]), interruptedIo('rename', 2))).toThrow(
      'rename interrupted'
    )
    expect(existsSync(join(dir, 'features.ndjson'))).toBe(false)
  })
})
