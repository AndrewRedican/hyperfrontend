import { resolve } from 'node:path'
import { biomeDetector } from './biome'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const BIOME_PROJECT = resolve(FIXTURES_DIR, 'biome-project')
const BIOME_JSONC_PROJECT = resolve(FIXTURES_DIR, 'biome-jsonc-project')

describe('biomeDetector', () => {
  it('returns null when biome is not detected', () => {
    const result = biomeDetector('/non/existent/path', { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects @biomejs/biome from package.json dependencies', () => {
    const result = biomeDetector('/some/path', {
      name: 'test-project',
      devDependencies: { '@biomejs/biome': '^1.5.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('biome')
    expect(result?.name).toBe('Biome')
    expect(result?.version).toBe('1.5.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.@biomejs/biome' }]))
  })

  it('detects biome.json config file', () => {
    const result = biomeDetector(BIOME_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('biome')
    expect(result?.configPath).toBe('biome.json')
    expect(result?.confidence).toBe(100)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'config-file', path: 'biome.json' }]))
  })

  it('detects biome.jsonc config file when biome.json not present', () => {
    const result = biomeDetector(BIOME_JSONC_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('biome')
    expect(result?.configPath).toBe('biome.jsonc')
    expect(result?.confidence).toBe(30)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'config-file', path: 'biome.jsonc' }]))
  })

  it('prefers biome.json over biome.jsonc', () => {
    const result = biomeDetector(BIOME_PROJECT)

    expect(result?.configPath).toBe('biome.json')
  })

  it('detects biome from regular dependencies (not just dev)', () => {
    const result = biomeDetector('/some/path', {
      name: 'test-project',
      dependencies: { '@biomejs/biome': '1.5.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('biome')
    expect(result?.version).toBe('1.5.0')
  })

  it('adds config file source when biome.json exists', () => {
    const result = biomeDetector(BIOME_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.confidence).toBeLessThanOrEqual(100)
    expect(result?.detectedFrom.length).toBeGreaterThan(0)
  })

  it('returns null for empty package.json', () => {
    const result = biomeDetector('/some/path', { name: 'empty' })
    expect(result).toBeNull()
  })

  it('handles package.json without dependencies', () => {
    const result = biomeDetector('/some/path', { name: 'no-deps', version: '1.0.0' })
    expect(result).toBeNull()
  })

  it('caps confidence at 100', () => {
    const result = biomeDetector(BIOME_PROJECT)

    expect(result?.confidence).toBeLessThanOrEqual(100)
  })
})
