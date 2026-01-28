import type { QueueCreatorValidity } from '../model'

export function getValidationError(operationType: string, validity: QueueCreatorValidity): string {
  const errorMap: Record<string, string> = {
    label: 'a label',
    operation: `${operationType} function`,
    logger: 'a logger',
    onSuccess: 'a success callback function',
    onFail: 'a failed callback function',
  }
  const invalidEntry = Object.entries(validity).find(([, value]) => value === false)
  if (!invalidEntry) return ''
  const [key] = invalidEntry
  return `Cannot create ${operationType} queue without ${errorMap[key]}`
}
