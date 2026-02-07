/* eslint-disable */
const tsJest = require('ts-jest').default
const t = tsJest.createTransformer()

function findRegexMatch(str: string, regex: RegExp, startIndex: number) {
  return regex.exec(str.slice(startIndex))
}

function findWhitespaceBeforeNewline(str: string, startIndex: number) {
  const reversedStr = str.substring(0, startIndex).split('').reverse().join('')
  const match = reversedStr.match(/[^\S\r\n]+(?=[\r\n])/)
  return match && match.index !== undefined ? startIndex - match.index - match[0].length : -1
}

function createWhitespaceString(N: number) {
  return ' '.repeat(N * 2)
}

function splitByFirstComma(str: string) {
  return str.split(/^(.*?),(.*)$/).filter(Boolean)
}

function processTuple(tupleStr: string, index: number) {
  const [label, value] = splitByFirstComma(tupleStr.trim().slice(1, -1))
  return { label: label.replaceAll(/'/g, '').trim(), value: value.trim() }
}

function doesLastLineContainAndAnd(text: string) {
  if (!text) return false
  const lines = text.split('\n')
  const lastLine = lines[lines.length - 1]
  return lastLine.includes('&&')
}

function replaceSemicolonsWithWhitespace(text: string) {
  return text.replace(/&&\s*;/gm, (match) => match.replace(';', ' '))
}

function transformLockedProps(text: string): string {
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
  const targetRef = originalTargetSubstring.match(/(?<=\s*lockedProps\()[^,]+/)?.[0]
  if (!targetRef) return text
  const replacementSubstring = originalTargetSubstring
    .replace(/\s*]\s*\)/m, '')
    .replace(/\s*lockedProps\(.*\[\s*/m, '')
    .split(/(?<=\]),/gm)
    .map(processTuple)
    .reduce((lines, { label, value }) => lines + `${baseIndentation};${true ? '(' : ''}${targetRef}.${label} = ${value} as any);\n`, '')
  const newCode = text.replace(originalTargetSubstring, replacementSubstring)
  return transformLockedProps(newCode)
}

function transformFreezeFunction(text: string) {
  const freezeFunctionRegex = /export function freeze\(target: object\): object \{[\s\S]*?\n\}/
  return text.replace(freezeFunctionRegex, 'export function freeze(target: object): object {\n  return target;\n}')
}

function stripLockedDecorator(text: string) {
  return text.replace(/@locked\(\)/g, '')
}

function transformLockedPropsHardcoded(text: string) {
  const indentationMatch = text.match(/(\s*)const properties/)
  const indentation = indentationMatch ? indentationMatch[1] : ''
  return text
    .replace(/const properties: \[string, any\]\[\] = \[\]\n/g, '')
    .replace(/properties\.push\(\['id', uuidV4\(\)\]\)\n/g, `${indentation}MessageBroker.id = uuidV4();`)
    .replace(/properties\.push\(\['\$name', name\]\)\n/g, `${indentation}MessageBroker.$name = name;`)
    .replace(/properties\.push\(\['settings', freeze\(settings\)\]\)\n/g, `${indentation}MessageBroker.settings = freeze(settings);`)
    .replace(
      /contractLocked &&\n\s*properties\.push\(\[\n\s*'contract',\n\s*freeze\(Object\.assign\(\{accepted: \[\], emitted: \[\]\}, contract\)\)\n\s*\]\)\n/g,
      `${indentation}if (contractLocked) {${indentation}  MessageBroker.contract = freeze(Object.assign({accepted: [], emitted: []}, contract)) as any;${indentation}}`
    )
    .replace(/lockedProps\(MessageBroker, properties\)/g, '')
}

function removeReadonly(text: string) {
  return text.replaceAll(/ readonly /gm, ' ')
}

function removePrivate(text: string) {
  return text.replaceAll(/ private /gm, ' ')
}

function transform(code: string) {
  code = transformLockedPropsHardcoded(code)
  code = transformLockedProps(code)
  code = stripLockedDecorator(code)
  code = transformFreezeFunction(code)
  code = removeReadonly(code)
  code = removePrivate(code)
  code = replaceSemicolonsWithWhitespace(code)
  return code
}

module.exports = {
  process(fileContent: string, filePath: string, jestConfig: any) {
    return t.process(transform(fileContent), filePath, jestConfig)
  },
}

// Mock random-generators
jest.mock('@hyperfrontend/random-generator-utils', () => ({
  uuidV4: () => '12345678-1234-1234-1234-123456789012',
  isUuidV4: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))
