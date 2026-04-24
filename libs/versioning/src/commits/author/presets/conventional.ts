import type { Step } from '../models/step'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { bodyStep } from '../steps/body'
import { breakingStep } from '../steps/breaking'
import { commitStep } from '../steps/commit'
import { issuesStep } from '../steps/issues'
import { previewStep } from '../steps/preview'
import { resolveScopeStep } from '../steps/resolve-scope'
import { scopeStep } from '../steps/scope'
import { subjectStep } from '../steps/subject'
import { typeStep } from '../steps/type'

/**
 * Default ordered step list used by `createAuthorSession` when the caller
 * does not supply their own sequence. Matches decision D8:
 * `resolve-scope → type → scope → subject → body → breaking → issues → preview → commit`.
 */
export const conventionalPreset: readonly Step[] = freeze([
  resolveScopeStep,
  typeStep,
  scopeStep,
  subjectStep,
  bodyStep,
  breakingStep,
  issuesStep,
  previewStep,
  commitStep,
])
