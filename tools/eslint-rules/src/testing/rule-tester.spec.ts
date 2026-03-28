import { RuleTester as TypeScriptRuleTester } from '@typescript-eslint/rule-tester'
import { RuleTester } from 'eslint'
import { createJsonRuleTester, createPackageJsonRuleTester, createProjectJsonRuleTester, createTypeScriptRuleTester } from './rule-tester'

describe('createJsonRuleTester', () => {
  it('creates a RuleTester instance', () => {
    const tester = createJsonRuleTester()

    expect(tester).toBeInstanceOf(RuleTester)
  })

  it('does not throw when created with default config', () => {
    expect(() => createJsonRuleTester()).not.toThrow()
  })
})

describe('createTypeScriptRuleTester', () => {
  // TypeScriptRuleTester registers afterAll hooks in constructor,
  // so we must instantiate outside test blocks
  const tester = createTypeScriptRuleTester()
  const testerWithOptions = createTypeScriptRuleTester({ projectService: false })

  it('creates a TypeScriptRuleTester instance', () => {
    expect(tester).toBeInstanceOf(TypeScriptRuleTester)
  })

  it('accepts projectService option', () => {
    expect(testerWithOptions).toBeInstanceOf(TypeScriptRuleTester)
  })
})

describe('createPackageJsonRuleTester', () => {
  it('creates a RuleTester instance (alias for JSON tester)', () => {
    const tester = createPackageJsonRuleTester()

    expect(tester).toBeInstanceOf(RuleTester)
  })
})

describe('createProjectJsonRuleTester', () => {
  it('creates a RuleTester instance (alias for JSON tester)', () => {
    const tester = createProjectJsonRuleTester()

    expect(tester).toBeInstanceOf(RuleTester)
  })
})
