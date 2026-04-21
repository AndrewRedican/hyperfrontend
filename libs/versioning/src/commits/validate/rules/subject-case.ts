import type { Rule } from '../models/rule'

/** Supported subject-case modes. */
export type SubjectCase = 'sentence-case' | 'lower-case' | 'upper-case' | 'kebab-case' | 'snake-case' | 'start-case'

/** Options for the subject-case rule. */
export interface SubjectCaseOptions {
  /** One or more accepted case forms. A subject passing any accepted form is valid. */
  readonly cases: readonly SubjectCase[]
}

/**
 * Rule that fails when the commit subject does not match any of the configured
 * case forms. An empty subject always passes (handled by subject-empty).
 *
 * @example Enforcing lower-case subjects
 * ```typescript
 * subjectCaseRule.check(
 *   parseConventionalCommit('feat: Add login'),
 *   { level: 'error', options: { cases: ['lower-case'] } }
 * )
 * // => ['subject must be one of [lower-case] but was "Add login"']
 * ```
 */
export const subjectCaseRule: Rule<SubjectCaseOptions> = {
  name: 'subject-case',
  check(commit, context) {
    const cases = context.options?.cases ?? []
    if (cases.length === 0) return []
    const subject = commit.subject
    if (subject.trim() === '') return []
    for (const form of cases) {
      if (matchesCase(subject, form)) return []
    }
    return [`subject must be one of [${cases.join(', ')}] but was "${subject}"`]
  },
}

/**
 * Checks whether the subject matches the given case form.
 *
 * @param subject - Subject text to inspect
 * @param form - Target case form
 * @returns True when the subject matches the form
 */
function matchesCase(subject: string, form: SubjectCase): boolean {
  switch (form) {
    case 'sentence-case':
      return isSentenceCase(subject)
    case 'lower-case':
      return isLowerCase(subject)
    case 'upper-case':
      return isUpperCase(subject)
    case 'kebab-case':
      return isKebabCase(subject)
    case 'snake-case':
      return isSnakeCase(subject)
    case 'start-case':
      return isStartCase(subject)
  }
}

/**
 * Sentence case requires the first alphabetic character to be uppercase; other
 * characters are not constrained.
 *
 * @param subject - Subject text to inspect
 * @returns True when the first alphabetic character is uppercase
 */
function isSentenceCase(subject: string): boolean {
  for (const char of subject) {
    if (isAlpha(char)) return isUpperChar(char)
  }
  return true
}

/**
 * Lower case requires every alphabetic character to be lowercase.
 *
 * @param subject - Subject text to inspect
 * @returns True when no alphabetic character is uppercase
 */
function isLowerCase(subject: string): boolean {
  for (const char of subject) {
    if (isAlpha(char) && isUpperChar(char)) return false
  }
  return true
}

/**
 * Upper case requires every alphabetic character to be uppercase.
 *
 * @param subject - Subject text to inspect
 * @returns True when no alphabetic character is lowercase
 */
function isUpperCase(subject: string): boolean {
  for (const char of subject) {
    if (isAlpha(char) && isLowerChar(char)) return false
  }
  return true
}

/**
 * Kebab case: lowercase alphanumerics, hyphen-separated, no spaces or underscores.
 *
 * @param subject - Subject text to inspect
 * @returns True when the subject is valid kebab-case
 */
function isKebabCase(subject: string): boolean {
  for (const char of subject) {
    if (char === '-') continue
    if (isAlpha(char) && isLowerChar(char)) continue
    if (isDigit(char)) continue
    return false
  }
  return true
}

/**
 * Snake case: lowercase alphanumerics, underscore-separated, no spaces or hyphens.
 *
 * @param subject - Subject text to inspect
 * @returns True when the subject is valid snake_case
 */
function isSnakeCase(subject: string): boolean {
  for (const char of subject) {
    if (char === '_') continue
    if (isAlpha(char) && isLowerChar(char)) continue
    if (isDigit(char)) continue
    return false
  }
  return true
}

/**
 * Start case: each whitespace-separated word begins with an uppercase letter.
 *
 * @param subject - Subject text to inspect
 * @returns True when every word starts with an uppercase letter
 */
function isStartCase(subject: string): boolean {
  let expectUpper = true
  for (const char of subject) {
    if (char === ' ') {
      expectUpper = true
      continue
    }
    if (expectUpper) {
      if (isAlpha(char) && !isUpperChar(char)) return false
      expectUpper = false
    }
  }
  return true
}

/**
 * Returns true when the character is an ASCII letter.
 *
 * @param char - Single character to classify
 * @returns True when the character is a-z or A-Z
 */
function isAlpha(char: string): boolean {
  const code = char.charCodeAt(0)
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

/**
 * Returns true when the character is an ASCII digit.
 *
 * @param char - Single character to classify
 * @returns True when the character is 0-9
 */
function isDigit(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 48 && code <= 57
}

/**
 * Returns true when the character is an uppercase ASCII letter.
 *
 * @param char - Single character to classify
 * @returns True when the character is A-Z
 */
function isUpperChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 65 && code <= 90
}

/**
 * Returns true when the character is a lowercase ASCII letter.
 *
 * @param char - Single character to classify
 * @returns True when the character is a-z
 */
function isLowerChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 97 && code <= 122
}
