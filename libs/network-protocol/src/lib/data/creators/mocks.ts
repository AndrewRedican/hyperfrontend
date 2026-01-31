import type { SerializedData } from '../model'

export const pid = '5815e1c3-4083-4d3c-8795-96c4c2965f2d'

export const id = '8b115bcd-d59b-4834-9290-b9a3a46df988'

export const sequence = 1

export const key = '19af5c5b-b0ac-45dc-a140-fa310a84b136'

export const message = {
  content: 'test message',
}

export const schema = {
  type: 'object',
  properties: {
    content: { type: 'string' },
  },
}

export const schemaHash = 'c3e185f09eb2087519e0266b0538551ff121901e1c9ebbe26d8ec4c0ea1bcd4b'

export const data: SerializedData<typeof message> = {
  pid,
  id,
  sequence,
  key,
  message: <JSONString<typeof message>>JSON.stringify(message), // Runtime: string, Type: JSONString<typeof message>
  schema,
  schemaHash,
}
