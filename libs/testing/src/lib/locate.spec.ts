import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { locateRuntimeEntry } from './locate'

const OWN_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const PACKAGE_SRC = join(OWN_DIRECTORY, '..')

/**
 * Lays out a package the way the build emits it: one `index.mjs` per entry directory.
 *
 * @param entries - The entry directories to create, with `.` standing for the main entry.
 * @returns The directory a sibling entry would locate from.
 */
function builtLayout(entries: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hf-locate-'))
  for (const entry of entries) {
    mkdirSync(join(root, entry), { recursive: true })
    writeFileSync(join(root, entry, 'index.mjs'), '')
  }
  mkdirSync(join(root, 'runner'), { recursive: true })
  return join(root, 'runner')
}

describe('locateRuntimeEntry', () => {
  it('finds the TypeScript entries beside a module in the source checkout', () => {
    assert.deepEqual(
      {
        main: locateRuntimeEntry('main', OWN_DIRECTORY),
        hooks: locateRuntimeEntry('hooks', OWN_DIRECTORY),
        dom: locateRuntimeEntry('dom', OWN_DIRECTORY),
        reporter: locateRuntimeEntry('reporter', OWN_DIRECTORY),
      },
      {
        main: join(PACKAGE_SRC, 'index.ts'),
        hooks: join(PACKAGE_SRC, 'hooks', 'index.ts'),
        dom: join(PACKAGE_SRC, 'dom', 'index.ts'),
        reporter: join(PACKAGE_SRC, 'reporter', 'index.ts'),
      }
    )
  })

  it('finds the ES module entries beside a module in the built package', () => {
    const from = builtLayout(['.', 'hooks', 'dom', 'reporter'])
    assert.deepEqual(
      {
        main: locateRuntimeEntry('main', from),
        hooks: locateRuntimeEntry('hooks', from),
      },
      {
        main: join(from, '..', 'index.mjs'),
        hooks: join(from, '..', 'hooks', 'index.mjs'),
      }
    )
  })

  it('prefers the TypeScript source when both layouts are present', () => {
    const from = builtLayout(['hooks'])
    writeFileSync(join(from, '..', 'hooks', 'index.ts'), '')
    assert.equal(locateRuntimeEntry('hooks', from), join(from, '..', 'hooks', 'index.ts'))
  })

  it('refuses a directory that holds neither layout', () => {
    assert.throws(() => locateRuntimeEntry('dom', builtLayout(['hooks'])), /cannot find its dom entry/)
  })
})
