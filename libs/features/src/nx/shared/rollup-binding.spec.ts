import { join } from 'node:path'
import { resolveSdkManifest } from '../../generators/metadata/sdk-version'
import { warnIfRollupBindingMissing } from './rollup-binding'

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..', '..', '..')
const PLATFORM_MARKER = `-${process.platform}-${process.arch}`
const CANDIDATE = `@rollup/rollup${PLATFORM_MARKER}-test`

function candidateManifest(): Record<string, unknown> {
  return { optionalDependencies: { [CANDIDATE]: '9.9.9' } }
}

function expectedWarning(remediation: string): string {
  return `Rollup's native binding for this platform is not installed (expected one of: ${CANDIDATE}@9.9.9). \`hf build\` and the @hyperfrontend/features build executor need it to bundle. Run \`${remediation}\` to install it.\n`
}

describe('resolveSdkManifest', () => {
  it('ascends from the running module to the SDK manifest by default', () => {
    const manifest = resolveSdkManifest()
    expect(manifest['name']).toBe('@hyperfrontend/features')
    expect(typeof manifest['version']).toBe('string')
  })

  it('returns the manifest immediately when the start directory holds it', () => {
    expect(resolveSdkManifest(join(WORKSPACE_ROOT, 'libs', 'features'))['name']).toBe('@hyperfrontend/features')
  })

  it('skips unrelated manifests along the ascent and throws when none matches', () => {
    expect(() => resolveSdkManifest(join(WORKSPACE_ROOT, 'libs', 'project-scope', 'src'))).toThrow(
      /Could not locate the @hyperfrontend\/features package\.json above/
    )
  })
})

describe('warnIfRollupBindingMissing', () => {
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  it('stays silent against this repository, where the platform binding is installed', () => {
    warnIfRollupBindingMissing(WORKSPACE_ROOT)
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('stays silent when the plugin manifest cannot be located', () => {
    const stderr = { write: jest.fn() }
    warnIfRollupBindingMissing('/ws', {
      loadManifest: () => {
        throw new Error('no manifest')
      },
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
    })
    expect(stderr.write).not.toHaveBeenCalled()
  })

  it('stays silent when the manifest has no optionalDependencies object', () => {
    const stderr = { write: jest.fn() }
    warnIfRollupBindingMissing('/ws', { loadManifest: () => ({}), stderr: <NodeJS.WritableStream>(<unknown>stderr) })
    warnIfRollupBindingMissing('/ws', {
      loadManifest: () => ({ optionalDependencies: 'not an object' }),
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
    })
    expect(stderr.write).not.toHaveBeenCalled()
  })

  it('stays silent when no optional dependency targets the running platform', () => {
    const stderr = { write: jest.fn() }
    warnIfRollupBindingMissing('/ws', {
      loadManifest: () => ({ optionalDependencies: { '@rollup/rollup-other-platform': '9.9.9' } }),
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
    })
    expect(stderr.write).not.toHaveBeenCalled()
  })

  it('matches candidates only on a token boundary so a prefix arch never claims a longer one', () => {
    const stderr = { write: jest.fn() }
    const resolveBinding = jest.fn(() => {
      throw new Error('not installed')
    })
    warnIfRollupBindingMissing('/ws', {
      loadManifest: () => ({
        optionalDependencies: {
          [`@rollup/rollup${PLATFORM_MARKER}zzz-test`]: '9.9.9',
          [`@rollup/rollup${PLATFORM_MARKER}`]: '8.8.8',
        },
      }),
      resolveBinding,
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
      pathExists: () => false,
    })
    expect(resolveBinding).toHaveBeenCalledTimes(1)
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining(`@rollup/rollup${PLATFORM_MARKER}@8.8.8`))
    expect(stderr.write).toHaveBeenCalledWith(expect.not.stringContaining('zzz'))
  })

  it('stays silent when any candidate resolves from the workspace root', () => {
    const stderr = { write: jest.fn() }
    const resolveBinding = jest.fn((packageName: string) => {
      if (packageName === CANDIDATE) {
        throw new Error('not installed')
      }
      return '/ws/node_modules/binding.node'
    })
    warnIfRollupBindingMissing('/ws', {
      loadManifest: () => ({ optionalDependencies: { [CANDIDATE]: '9.9.9', [`${CANDIDATE}-musl`]: '9.9.9' } }),
      resolveBinding,
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
    })
    expect(stderr.write).not.toHaveBeenCalled()
    expect(resolveBinding).toHaveBeenCalledTimes(2)
  })

  it.each<[string[], string]>([
    [['package-lock.json'], 'npm install --include=optional'],
    [['yarn.lock'], 'yarn install'],
    [['pnpm-lock.yaml'], 'pnpm install'],
    [['bun.lockb'], 'bun install'],
  ])('warns once with the %j remediation when no candidate resolves', (lockfiles, remediation) => {
    const stderr = { write: jest.fn() }
    warnIfRollupBindingMissing('/ws', {
      loadManifest: candidateManifest,
      resolveBinding: () => {
        throw new Error('not installed')
      },
      stderr: <NodeJS.WritableStream>(<unknown>stderr),
      pathExists: (relativePath) => lockfiles.includes(relativePath),
    })
    expect(stderr.write).toHaveBeenCalledTimes(1)
    expect(stderr.write).toHaveBeenCalledWith(expectedWarning(remediation))
  })

  it('defaults to process.stderr and on-disk lockfile detection', () => {
    warnIfRollupBindingMissing(WORKSPACE_ROOT, {
      loadManifest: candidateManifest,
      resolveBinding: () => {
        throw new Error('not installed')
      },
    })
    expect(stderrSpy).toHaveBeenCalledTimes(1)
    expect(stderrSpy).toHaveBeenCalledWith(expectedWarning('npm install --include=optional'))
  })
})
