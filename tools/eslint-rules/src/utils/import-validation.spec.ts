import { createLogger } from '@hyperfrontend/logging'
import {
  findWorkspaceRoot,
  findProjectRoot,
  readJsonFile,
  readJsonFileIfExists,
  createScopedLogger,
  exists,
  isDirectory,
  readDirectory,
} from '@hyperfrontend/project-scope'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('Import Validation', () => {
  it('imports findWorkspaceRoot from project-scope', () => {
    expect(typeof findWorkspaceRoot).toBe('function')
  })

  it('imports findProjectRoot from project-scope', () => {
    expect(typeof findProjectRoot).toBe('function')
  })

  it('imports readJsonFile from project-scope', () => {
    expect(typeof readJsonFile).toBe('function')
  })

  it('imports readJsonFileIfExists from project-scope', () => {
    expect(typeof readJsonFileIfExists).toBe('function')
  })

  it('imports createLogger from logging', () => {
    expect(typeof createLogger).toBe('function')
  })

  it('imports createScopedLogger from project-scope', () => {
    expect(typeof createScopedLogger).toBe('function')
  })

  it('imports exists from project-scope', () => {
    expect(typeof exists).toBe('function')
  })

  it('imports isDirectory from project-scope', () => {
    expect(typeof isDirectory).toBe('function')
  })

  it('imports readDirectory from project-scope', () => {
    expect(typeof readDirectory).toBe('function')
  })
})
