import { after } from 'node:test'
import { RuleTester as TypeScriptRuleTester } from '@typescript-eslint/rule-tester'
import { RuleTester } from 'eslint'
import { describe, it } from '@hyperfrontend/testing'

// why: both testers look for their framework on the globals, and nothing is injected here.
// why: ESLint's own tester silently runs its cases inline when it finds none, so they pass without ever being reported as tests.
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only
TypeScriptRuleTester.afterAll = after
TypeScriptRuleTester.describe = describe
TypeScriptRuleTester.describeSkip = describe.skip
TypeScriptRuleTester.it = it
TypeScriptRuleTester.itOnly = it.only
TypeScriptRuleTester.itSkip = it.skip
