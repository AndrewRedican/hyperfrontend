/* eslint-disable */
const tsJest = require('ts-jest').default
const t = tsJest.createTransformer()

function findRegexMatch(str, regex, startIndex) {
  return regex.exec(str.slice(startIndex))
}

function findWhitespaceBeforeNewline(str, startIndex) {
  const reversedStr = str.substring(0, startIndex).split('').reverse().join('')
  const match = reversedStr.match(/[^\S\r\n]+(?=[\r\n])/)
  return match ? startIndex - match.index - match[0].length : -1
}

function createWhitespaceString(N) {
  return ' '.repeat(N * 2)
}

function splitByFirstComma(str) {
  return str.split(/^(.*?),(.*)$/).filter(Boolean)
}

function processTuple(tupleStr, index) {
  const [label, value] = splitByFirstComma(tupleStr.trim().slice(1, -1))
  if (!label || !value) {
    return null
  }
  return { label: label.replaceAll(/'/g, '').trim(), value: value.trim() }
}

function doesLastLineContainAndAnd(text) {
  if (!text) return false
  const lines = text.split('\n')
  const lastLine = lines[lines.length - 1]
  return lastLine.includes('&&')
}

function replaceSemicolonsWithWhitespace(text) {
  return text.replace(/&&\s*;/gm, (match) => match.replace(';', ' '))
}

function transformLockedProps(text) {
  if (!text) return text
  const lockedPropsStr = 'lockedProps('
  let startIndex = text.indexOf(lockedPropsStr)
  if (startIndex < 0) return text
  const endMatch = findRegexMatch(text, /]\s*\)/m, startIndex)
  if (!endMatch) return text
  const endIndex = startIndex + endMatch.index + endMatch[0].length
  if (endIndex < 0) return text
  const startIndexWithWhitespace = findWhitespaceBeforeNewline(text, startIndex)
  let depth = 0
  let baseIndentation = ''
  if (startIndexWithWhitespace >= 0) {
    depth = Math.floor((startIndex - startIndexWithWhitespace) / 2)
    baseIndentation = createWhitespaceString(depth)
    startIndex = startIndexWithWhitespace
  }
  const originalTargetSubstring = text.slice(startIndex, endIndex)

  // Skip single-line lockedProps calls (e.g., those within void expressions)
  const lines = originalTargetSubstring.split('\n')
  if (lines.length <= 1 || (lines.length === 2 && lines[1].trim() === '')) {
    // Skip this match and continue looking for the next one
    const remainingText = text.slice(endIndex)
    const transformedRemaining = transformLockedProps(remainingText)
    return text.slice(0, endIndex) + transformedRemaining
  }

  const targetRef = originalTargetSubstring.match(/(?<=\s*lockedProps\()[^,]+/)
  if (!targetRef) return text
  const replacementSubstring = originalTargetSubstring
    .replace(/\s*]\s*\)/m, '')
    .replace(/\s*lockedProps\(.*\[\s*/m, '')
    .split(/(?<=\]),/gm)
    .map(processTuple)
    .filter(Boolean)
    .reduce((lines, { label, value }) => lines + `${baseIndentation};${true ? '(' : ''}${targetRef[0]}.${label} = ${value} as any);\n`, '')
  const newCode = text.replace(originalTargetSubstring, replacementSubstring)
  return transformLockedProps(newCode)
}

function transformFreezeFunction(text) {
  const freezeFunctionRegex = /export function freeze\(target: object\): object \{[\s\S]*?\n\}/
  return text.replace(freezeFunctionRegex, 'export function freeze(target: object): object {\n  return target;\n}')
}

function stripLockedDecorator(text) {
  return text.replace(/@locked\(\)/g, '')
}

function transformLockedPropsHardcoded(text) {
  const indentationMatch = text.match(/(\s*)const properties/)
  const indentation = indentationMatch ? indentationMatch[1] : ''
  return text
    .replace(/const properties: \[string, any\]\[\] = \[\]\n/g, '')
    .replace(/properties\.push\(\['id', uuidV4\(\)\]\)\n/g, `${indentation}MessageBroker.id = uuidV4();\n`)
    .replace(/properties\.push\(\['\$name', name\]\)\n/g, `${indentation}MessageBroker.$name = name;\n`)
    .replace(/properties\.push\(\['settings', freeze\(settings\)\]\)\n/g, `${indentation}MessageBroker.settings = freeze(settings);\n`)
    .replace(
      /void \(contractLocked && properties\.push\(\[\s*'contract',\s*freeze\(Object\.assign\(\{[\s\S]*?\}, contract\)\)\s*\]\)\)\n/g,
      `${indentation}void (contractLocked && (MessageBroker.contract = freeze(Object.assign({accepted: [], emitted: []}, contract)) as any));\n`
    )
    .replace(
      /contractLocked &&\n\s*properties\.push\(\[\n\s*'contract',\n\s*freeze\(Object\.assign\(\{accepted: \[\], emitted: \[\]\}, contract\)\)\n\s*\]\)\n/g,
      `${indentation}if (contractLocked) {${indentation}  MessageBroker.contract = freeze(Object.assign({accepted: [], emitted: []}, contract)) as any;${indentation}}`
    )
    .replace(/\s*lockedProps\(MessageBroker, properties\)\n/g, '')
}

function removeReadonly(text) {
  return text.replaceAll(/ readonly /gm, ' ')
}

function removePrivate(text) {
  return text.replaceAll(/ private /gm, ' ')
}

function transform(code) {
  code = transformLockedPropsHardcoded(code)
  code = transformLockedProps(code)
  code = stripLockedDecorator(code)
  code = transformFreezeFunction(code)
  code = removeReadonly(code)
  code = removePrivate(code)
  code = replaceSemicolonsWithWhitespace(code)
  return code
}

module = module.exports = {
  process(fileContent, filePath, jestConfig) {
    return t.process(transform(fileContent), filePath, jestConfig)
  },
}
