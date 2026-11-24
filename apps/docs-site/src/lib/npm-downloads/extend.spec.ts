import type { DownloadDay } from '../downloads'
import type { ExtendOptions } from './extend'
import type { DailyDownloads, DatasetManifest } from './model'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commitDataset, readDataset } from './dataset'
import { extendDataset } from './extend'

const FEATURES = '@hyperfrontend/features'
const NEXUS = '@hyperfrontend/nexus'
const ORIGIN = 'https://statistics.example'
const NOW = Date.parse('2026-11-24T15:00:00.000Z')

/**
 * A run of consecutive days as the service answers them.
 *
 * @param first - The first day, as a day of November 2026
 * @param counts - One count per day
 * @returns The days
 */
function run(first: number, counts: number[]): DownloadDay[] {
  return counts.map((downloads, index) => ({ day: `2026-11-${String(first + index).padStart(2, '0')}`, downloads }))
}

/**
 * The same run as the records the dataset stores.
 *
 * @param packageName - The package the records belong to
 * @param first - The first day, as a day of November 2026
 * @param counts - One count per day
 * @returns One stored line per day, each naming the package
 */
function records(packageName: string, first: number, counts: number[]): DailyDownloads[] {
  return run(first, counts).map((entry) => ({ package: packageName, ...entry }))
}

/**
 * A manifest counted through 21 November.
 *
 * @param packages - Created days by package
 * @returns Bookkeeping a dataset can be seeded with
 */
function manifest(packages: Record<string, string>): DatasetManifest {
  return {
    version: 1,
    refreshedAt: '2026-11-22T19:18:21.680Z',
    frontier: '2026-11-21',
    revalidationDays: 7,
    packages: Object.fromEntries(Object.entries(packages).map(([name, created]) => [name, { created }])),
  }
}

/**
 * A well-formed answer counted through 23 November.
 *
 * @param packages - Days by package
 * @param frontier - Its frontier
 * @returns The answer body
 */
function answer(packages: Record<string, DownloadDay[]>, frontier = '2026-11-23'): Record<string, unknown> {
  return {
    version: 1,
    frontier,
    collectedAt: '2026-11-24T14:00:03.120Z',
    revalidationDays: 7,
    packages: Object.entries(packages).map(([name, days]) => ({
      package: name,
      created: name === NEXUS ? '2026-02-15' : '2026-06-28',
      total: days.reduce((sum, entry) => sum + entry.downloads, 0),
      days,
    })),
  }
}

let dir = ''
let asked: string[] = []

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'npm-downloads-extend-'))
  asked = []
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/**
 * Options for a run against a service that answers one way.
 *
 * @param body - The response body, serialized as JSON unless it is already text
 * @param status - The response status
 * @param packages - The published packages
 * @returns The options, with a fetch that records the address it was asked at
 */
function against(body: unknown, status = 200, packages: string[] = [FEATURES]): ExtendOptions {
  return {
    dir,
    packages,
    origin: ORIGIN,
    now: NOW,
    fetch: (url) => {
      asked.push(url)
      return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))
    },
  }
}

/**
 * Store the features package counted through 21 November.
 */
function seedFeatures(): void {
  commitDataset(dir, manifest({ [FEATURES]: '2026-06-28' }), new Map([[FEATURES, records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 7, 8])]]))
}

describe('extendDataset, the request', () => {
  it('asks for the whole history, whatever is stored', async () => {
    seedFeatures()
    await extendDataset(against(answer({ [FEATURES]: run(14, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) })))
    expect(asked).toEqual([`${ORIGIN}/v1/downloads`])
  })

  it('gives the request a deadline', async () => {
    let signal: AbortSignal | null | undefined
    const options = against(answer({ [FEATURES]: run(14, [1]) }))
    await extendDataset({
      ...options,
      fetch: (url, init) => {
        signal = init.signal
        return options.fetch(url, init)
      },
    })
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('reports an unreachable service as unavailable, with the address it tried', async () => {
    const options = { ...against(null), fetch: () => Promise.reject(new TypeError('fetch failed')) }
    await expect(extendDataset(options)).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining(`did not answer at ${ORIGIN}/v1/downloads (TypeError: fetch failed)`),
    })
  })

  it('says so when the service is still making its first collection', async () => {
    await expect(extendDataset(against({ error: 'collecting' }, 503))).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('still making its first collection'),
    })
  })

  it('reports a 503 that is not the service collecting by its status', async () => {
    await expect(extendDataset(against('<html>bad gateway</html>', 503))).rejects.toThrow('answered 503')
  })

  it('reports any other refusal by its status', async () => {
    await expect(extendDataset(against({ error: 'since-not-a-day' }, 400))).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('answered 400'),
    })
  })

  it('refuses an answer that is not JSON', async () => {
    await expect(extendDataset(against('not json'))).rejects.toMatchObject({
      kind: 'schema-drift',
      message: expect.stringContaining('is not JSON'),
    })
  })

  it('refuses an answer in another shape', async () => {
    await expect(extendDataset(against({ ...answer({}), version: 2 }))).rejects.toThrow('is version 2')
  })
})

describe('extendDataset, the write', () => {
  it('replaces revised days and appends the new ones', async () => {
    seedFeatures()
    await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 70, 80, 9, 10]) })))
    expect(readDataset(dir).days).toEqual(new Map([[FEATURES, records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 70, 80, 9, 10])]]))
  })

  it('reports the files it wrote and the frontier it reached', async () => {
    seedFeatures()
    expect(await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8, 9, 10]) })))).toEqual({
      outcome: 'refreshed',
      frontier: '2026-11-23',
      changed: ['features.ndjson', 'manifest.json'],
    })
  })

  it('writes a manifest stamped with the run and the frontier answered', async () => {
    seedFeatures()
    await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8, 9, 10]) })))
    expect(readDataset(dir).manifest).toEqual({
      version: 1,
      refreshedAt: '2026-11-24T15:00:00.000Z',
      frontier: '2026-11-23',
      revalidationDays: 7,
      packages: { [FEATURES]: { created: '2026-06-28' } },
    })
  })

  it('stores every day of a package new to the dataset', async () => {
    seedFeatures()
    await extendDataset(
      against(answer({ [FEATURES]: run(14, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), [NEXUS]: run(20, [4, 4, 4, 4]) }), 200, [FEATURES, NEXUS])
    )
    expect({ days: readDataset(dir).days.get(NEXUS), record: readDataset(dir).manifest?.packages[NEXUS] }).toEqual({
      days: records(NEXUS, 20, [4, 4, 4, 4]),
      record: { created: '2026-02-15' },
    })
  })

  it('writes the manifest alone when only the frontier moved', async () => {
    seedFeatures()
    const result = await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8]) }, '2026-11-22')))
    expect(result).toEqual({ outcome: 'refreshed', frontier: '2026-11-22', changed: ['manifest.json'] })
  })

  it('reports up to date when every answered day matches what is stored', async () => {
    seedFeatures()
    const result = await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8]) }, '2026-11-21')))
    expect(result).toEqual({ outcome: 'up-to-date', frontier: '2026-11-21', changed: [] })
  })

  it('writes the manifest when a stored package is new to it', async () => {
    commitDataset(dir, manifest({}), new Map([[FEATURES, records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 7, 8])]]))
    const result = await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8]) }, '2026-11-21')))
    expect(result).toEqual({ outcome: 'refreshed', frontier: '2026-11-21', changed: ['manifest.json'] })
  })

  it('leaves the manifest untouched when every answered day matches', async () => {
    seedFeatures()
    await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8]) }, '2026-11-21')))
    expect(readDataset(dir).manifest).toEqual(manifest({ [FEATURES]: '2026-06-28' }))
  })

  it('reports up to date through the stored frontier when the answer is older', async () => {
    seedFeatures()
    expect(await extendDataset(against(answer({ [FEATURES]: run(15, [9, 9, 9, 9, 9, 9]) }, '2026-11-20')))).toEqual({
      outcome: 'up-to-date',
      frontier: '2026-11-21',
      changed: [],
    })
  })

  it('writes nothing when the answer is older', async () => {
    seedFeatures()
    await extendDataset(against(answer({ [FEATURES]: run(15, [9, 9, 9, 9, 9, 9]) }, '2026-11-20')))
    expect(readDataset(dir).days.get(FEATURES)).toEqual(records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 7, 8]))
  })

  it('keeps the records and the created day of a published package the answer lacks', async () => {
    commitDataset(
      dir,
      manifest({ [FEATURES]: '2026-06-28', [NEXUS]: '2026-02-15' }),
      new Map([
        [FEATURES, records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 7, 8])],
        [NEXUS, records(NEXUS, 14, [1, 1, 1, 1, 1, 1, 1, 1])],
      ])
    )
    await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8, 9, 10]) }), 200, [FEATURES, NEXUS]))
    expect({ days: readDataset(dir).days.get(NEXUS), record: readDataset(dir).manifest?.packages[NEXUS] }).toEqual({
      days: records(NEXUS, 14, [1, 1, 1, 1, 1, 1, 1, 1]),
      record: { created: '2026-02-15' },
    })
  })

  it('leaves a published package the service and the dataset both lack out of the manifest', async () => {
    await extendDataset(against(answer({ [FEATURES]: run(14, [1, 2]) }), 200, [FEATURES, NEXUS]))
    expect(readDataset(dir).manifest?.packages).toEqual({ [FEATURES]: { created: '2026-06-28' } })
  })

  it('keeps the file of a package that is no longer published', async () => {
    commitDataset(
      dir,
      manifest({ [FEATURES]: '2026-06-28', [NEXUS]: '2026-02-15' }),
      new Map([
        [FEATURES, records(FEATURES, 14, [1, 2, 3, 4, 5, 6, 7, 8])],
        [NEXUS, records(NEXUS, 14, [1, 1, 1, 1, 1, 1, 1, 1])],
      ])
    )
    await extendDataset(against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8, 9, 10]) })))
    expect(readDataset(dir).days.get(NEXUS)).toEqual(records(NEXUS, 14, [1, 1, 1, 1, 1, 1, 1, 1]))
  })

  it('fails on an answer that would leave a hole in a package', async () => {
    seedFeatures()
    await expect(extendDataset(against(answer({ [FEATURES]: run(23, [10]) })))).rejects.toThrow('jumps from 2026-11-21 to 2026-11-23')
  })

  it('writes nothing when a merge fails', async () => {
    seedFeatures()
    const before = readFileSync(join(dir, 'manifest.json'), 'utf8')
    await extendDataset(against(answer({ [FEATURES]: run(23, [10]) }))).catch(() => undefined)
    expect({ manifest: readFileSync(join(dir, 'manifest.json'), 'utf8'), staged: existsSync(join(dir, 'manifest.json.tmp')) }).toEqual({
      manifest: before,
      staged: false,
    })
  })

  it('tells whoever is watching what it asked for and what it found', async () => {
    seedFeatures()
    const lines: string[] = []
    await extendDataset({
      ...against(answer({ [FEATURES]: run(15, [2, 3, 4, 5, 6, 7, 8]) }, '2026-11-21')),
      onProgress: (line) => lines.push(line),
    })
    expect(lines).toEqual([
      'Asking the statistics service for the whole history',
      'The statistics service has counted through 2026-11-21',
      'Every answered day matched what was stored; nothing to write.',
    ])
  })
})
