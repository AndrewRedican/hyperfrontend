import type { PackedConsumer } from './packed-consumer'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createTempDir } from '../fs/temp-dir'
import { createPackedConsumer, npmArguments, usePackedConsumer } from './packed-consumer'

/** The packages the suites pack, as the trees `npm pack` is run over. */
const PACKAGES = {
  pkg: {
    'package.json': {
      name: '@probe/pkg',
      version: '1.0.0',
      exports: {
        '.': { import: './index.mjs', require: './index.cjs' },
        './sub': './sub.js',
        './broken': './broken.mjs',
        './package.json': './package.json',
      },
    },
    'index.mjs': 'export const answer = 42\n',
    'index.cjs': 'exports.answer = 42\n',
    'sub.js': 'module.exports = { sub: true }\n',
    'broken.mjs': "throw new Error('boom at load')\n",
  },
  peer: { 'package.json': { name: '@probe/peer', version: '2.0.0', main: 'index.js' }, 'index.js': 'module.exports = {}\n' },
  plain: { 'package.json': { name: '@probe/plain', version: '3.0.0', main: 'index.js' }, 'index.js': 'module.exports = { plain: true }\n' },
}

const source = createTempDir({
  tree: Object.fromEntries(
    Object.entries(PACKAGES).flatMap(([dir, tree]) => Object.entries(tree).map(([path, content]) => [posix.join(dir, path), content]))
  ),
})
after(() => source.remove())

/**
 * Packs one of the fixture packages and returns the tarball's path.
 *
 * @param name - The fixture directory.
 * @returns The absolute path of the `.tgz` npm wrote beside it.
 */
function pack(name: keyof typeof PACKAGES): string {
  const output = execFileSync('npm', ['pack', '--json', '--loglevel=error'], {
    cwd: source.resolve(name),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const [result] = JSON.parse(output) as Array<{ filename: string }>
  return source.resolve(name, result.filename)
}

const tarballs = { pkg: pack('pkg'), peer: pack('peer'), plain: pack('plain') }

describe('createPackedConsumer', () => {
  let consumer: PackedConsumer
  before(() => {
    consumer = createPackedConsumer({ tarball: tarballs.pkg })
  })
  after(() => consumer.remove())

  it('reports the installed package name', () => {
    assert.equal(consumer.packageName, '@probe/pkg')
  })

  it('installs the package under the consumer directory', () => {
    assert.equal(existsSync(join(consumer.path, 'node_modules', '@probe', 'pkg', 'index.mjs')), true)
  })

  it('loads every exports entry under both module systems, skipping the manifest subpath', () => {
    assert.deepEqual(
      consumer.entries().map((entry) => `${entry.kind} ${entry.specifier} ${entry.ok}`),
      [
        'import @probe/pkg true',
        'require @probe/pkg true',
        'import @probe/pkg/sub true',
        'require @probe/pkg/sub true',
        'import @probe/pkg/broken false',
        'require @probe/pkg/broken false',
      ]
    )
  })

  it('reports the first error lines of an entry that fails to load', () => {
    const broken = consumer.entries('import').find((entry) => entry.specifier === '@probe/pkg/broken')
    assert.match(broken?.message ?? '', /boom at load/)
  })

  it('restricts the probe to one module system', () => {
    assert.deepEqual(
      consumer.entries('require').map((entry) => entry.kind),
      ['require', 'require', 'require']
    )
  })

  it('runs a function as an ES module and returns what it resolved to', () => {
    assert.equal(
      consumer.run(async (args: { specifier: string }) => (await import(args.specifier)).answer, { args: { specifier: '@probe/pkg' } }),
      42
    )
  })

  it('runs a function as CommonJS when asked', () => {
    assert.equal(
      consumer.run(() => require('@probe/pkg').answer, { kind: 'require' }),
      42
    )
  })

  it('hands the function its argument as JSON', () => {
    assert.equal(
      consumer.run((args: { n: number }) => args.n * 2, { args: { n: 21 } }),
      42
    )
  })

  it('hands over an argument that would break a script it was spliced into, under both module systems', () => {
    const text = '\'"`${x}` */ </script> \\ \u2028\u2029'
    assert.deepEqual(
      [
        consumer.run((args: { text: string }) => args.text, { args: { text } }),
        consumer.run((args: { text: string }) => args.text, { args: { text }, kind: 'require' }),
      ],
      [text, text]
    )
  })

  it('carries an undefined result as null', () => {
    assert.equal(
      consumer.run(() => undefined),
      null
    )
  })

  it('runs the child from a directory inside the consumer when asked', () => {
    consumer.writeTree({ 'nested/marker.txt': 'here' })
    assert.equal(
      consumer.run(() => require('node:fs').existsSync('marker.txt'), { kind: 'require', cwd: 'nested' }),
      true
    )
  })

  it('withholds the test runner markers from the child', () => {
    assert.deepEqual(
      consumer.run(() => Object.keys(process.env).filter((key) => key === 'NODE_TEST_CONTEXT' || key.startsWith('HF_TEST_'))),
      []
    )
  })

  it('runs the child with the extra environment', () => {
    assert.equal(
      consumer.run(() => process.env['PROBE_VALUE'], { env: { PROBE_VALUE: 'set' } }),
      'set'
    )
  })

  it('throws with the child output when the function fails', () => {
    assert.throws(
      () =>
        consumer.run(() => {
          throw new Error('boom in run')
        }),
      /consumer\.run: the child exited with 1[\s\S]*boom in run/
    )
  })

  it('writes a file and runs it with plain Node', () => {
    const script = consumer.write('hello.mjs', "process.stdout.write('hello')\n")
    assert.deepEqual(consumer.node([script]), { status: 0, stdout: 'hello', stderr: '' })
  })

  it('writes a tree and lists the files under a directory', () => {
    consumer.writeTree({ 'tree/a.txt': 'a', 'tree/nested/b.txt': 'b' })
    assert.deepEqual(consumer.listFiles('tree'), ['a.txt', 'nested/b.txt'])
  })

  it('lists nothing for a directory that does not exist', () => {
    assert.deepEqual(consumer.listFiles('absent'), [])
  })
})

describe('createPackedConsumer with peers and without an exports map', () => {
  let consumer: PackedConsumer
  before(() => {
    consumer = createPackedConsumer({ tarball: tarballs.plain, peers: [tarballs.peer] })
  })
  after(() => consumer.remove())

  it('installs the peers beside the package', () => {
    assert.equal(existsSync(join(consumer.path, 'node_modules', '@probe', 'peer', 'package.json')), true)
  })

  it('probes the main entry under both module systems when the manifest has no exports map', () => {
    assert.deepEqual(
      consumer.entries().map((entry) => `${entry.kind} ${entry.specifier} ${entry.ok}`),
      ['import @probe/plain true', 'require @probe/plain true']
    )
  })
})

describe('createPackedConsumer with another Node binary', () => {
  it('runs the children on the binary given', () => {
    const consumer = createPackedConsumer({ tarball: tarballs.plain, node: process.execPath })
    try {
      assert.equal(
        consumer.run(() => process.execPath),
        process.execPath
      )
    } finally {
      consumer.remove()
    }
  })
})

describe('createPackedConsumer removal', () => {
  it('deletes the directory, and removing again is a no-op', () => {
    const consumer = createPackedConsumer({ tarball: tarballs.plain })
    consumer.remove()
    consumer.remove()
    assert.equal(existsSync(consumer.path), false)
  })
})

describe('createPackedConsumer refusals', () => {
  it('refuses a missing tarball option', () => {
    assert.throws(() => createPackedConsumer({ tarball: undefined }), /no tarball path was given/)
  })

  it('refuses a tarball path that does not exist', () => {
    assert.throws(() => createPackedConsumer({ tarball: source.resolve('absent.tgz') }), /does not exist/)
  })

  it('rethrows the install failure of a file npm cannot install', () => {
    const notATarball = source.write('not-a-tarball.tgz', 'plain text')
    assert.throws(() => createPackedConsumer({ tarball: notATarball }))
  })
})

describe('npmArguments', () => {
  it('quotes arguments with spaces for the Windows shell', () => {
    assert.deepEqual(npmArguments(['install', 'C:\\My Packages\\lib.tgz'], 'win32'), ['install', '"C:\\My Packages\\lib.tgz"'])
  })

  it('passes arguments through unchanged elsewhere', () => {
    assert.deepEqual(npmArguments(['install', 'my packages.tgz'], 'linux'), ['install', 'my packages.tgz'])
  })
})

describe('usePackedConsumer', () => {
  let seen: string | undefined

  describe('inside the suite', () => {
    const consumer = usePackedConsumer({ tarball: tarballs.pkg })
    let outside: unknown
    try {
      outside = consumer.packageName
    } catch (error) {
      outside = error
    }

    it('throws when read outside a test', () => {
      assert.match(String(outside), /exists only while a test or hook of the suite runs/)
    })

    it('reports the installed package name', () => {
      seen = consumer.path
      assert.equal(consumer.packageName, '@probe/pkg')
    })

    it('runs a function through the current consumer', () => {
      assert.equal(
        consumer.run(() => require('@probe/pkg/sub').sub, { kind: 'require' }),
        true
      )
    })

    it('forwards the file operations', () => {
      consumer.writeTree({ 'files/a.txt': 'a' })
      assert.deepEqual([consumer.listFiles('files'), consumer.write('files/b.txt', 'b').endsWith('b.txt')], [['a.txt'], true])
    })

    it('forwards node and entries', () => {
      assert.deepEqual([consumer.node(['-e', 'process.exit(0)']).status, consumer.entries('import').length], [0, 3])
    })
  })

  it('removes the consumer after the suite', () => {
    assert.equal(seen !== undefined && !existsSync(seen), true)
  })
})
