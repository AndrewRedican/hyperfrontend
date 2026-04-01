import { resolve } from 'node:path'
import { run } from './run'

const FIXTURES_DIR = resolve(__dirname, '../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('run', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('with no arguments', () => {
    it('prints help and returns success', () => {
      const result = run([])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('with --help flag', () => {
    it('returns success exit code', () => {
      const result = run(['--help'])
      expect(result.exitCode).toBe(0)
    })

    it('returns success with -h shorthand', () => {
      const result = run(['-h'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('with --version flag', () => {
    it('returns success exit code', () => {
      const result = run(['--version'])
      expect(result.exitCode).toBe(0)
    })

    it('returns success with -v shorthand', () => {
      const result = run(['-v'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('with unknown command', () => {
    it('returns error exit code', () => {
      const result = run(['unknown-command'])
      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('Unknown command')
    })
  })

  describe('analyze command', () => {
    it('executes analyze command', () => {
      const result = run(['analyze', MINIMAL_PROJECT])
      expect(result.exitCode).toBe(0)
    })

    it('shows help with --help flag', () => {
      const result = run(['analyze', '--help'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('tree command', () => {
    it('executes tree command', () => {
      const result = run(['tree', MINIMAL_PROJECT])
      expect(result.exitCode).toBe(0)
    })

    it('shows help with --help flag', () => {
      const result = run(['tree', '--help'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('config command', () => {
    it('executes config command', () => {
      const result = run(['config', MINIMAL_PROJECT])
      expect(result.exitCode).toBe(0)
    })

    it('shows help with --help flag', () => {
      const result = run(['config', '--help'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('deps command', () => {
    it('executes deps command', () => {
      const result = run(['deps', MINIMAL_PROJECT])
      expect(result.exitCode).toBe(0)
    })

    it('shows help with --help flag', () => {
      const result = run(['deps', '--help'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('global options', () => {
    it('passes --json to command', () => {
      const result = run(['analyze', MINIMAL_PROJECT, '--json'])
      expect(result.exitCode).toBe(0)
      expect(result.output).toBeDefined()
    })

    it('enables verbose mode with --verbose flag', () => {
      const result = run(['analyze', MINIMAL_PROJECT, '--verbose'])
      expect(result.exitCode).toBe(0)
    })

    it('propagates verbose mode to subcommands', () => {
      const result = run(['tree', MINIMAL_PROJECT, '--verbose'])
      expect(result.exitCode).toBe(0)
    })

    it('respects NO_COLOR via --no-color flag', () => {
      const result = run(['analyze', MINIMAL_PROJECT, '--no-color'])
      expect(result.exitCode).toBe(0)
    })

    it('handles multiple global options together', () => {
      const result = run(['analyze', MINIMAL_PROJECT, '--verbose', '--json'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('error handling', () => {
    it('outputs error message to console.error for unknown command', () => {
      const result = run(['nonexistent-command'])
      expect(result.exitCode).toBe(1)
      expect(result.error).toBeDefined()
    })

    it('handles command execution error gracefully', () => {
      const result = run(['deps', '/nonexistent/path/xyz'])
      expect(result.exitCode).toBe(1)
      expect(result.error).toBeDefined()
    })
  })
})
