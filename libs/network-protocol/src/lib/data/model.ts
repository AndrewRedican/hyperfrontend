import type { Schema } from 'jsonschema'

/**
 * Branded type representing a JSON-serialized string of type T.
 * This is a nominal type that carries information about what type
 * the string represents when parsed, while remaining a string at runtime.
 *
 * @template T - The type that this JSON string represents when parsed
 *
 * @example
 * ```typescript
 * const jsonStr: JSONString<{ name: string }> = '{"name":"Alice"}' as JSONString<{ name: string }>
 * const parsed: { name: string } = JSON.parse(jsonStr)
 * ```
 */
export type JSONString<T = unknown> = string & {
  readonly __jsonBrand: unique symbol
  readonly __type: T
}

/**
 * Serialized wire format for Data.
 * This represents data as it's stored, transmitted, and encrypted.
 * The message field is always a JSON string representation.
 *
 * @template T - The logical type that the message represents when deserialized
 */
export interface SerializedData<T = unknown> {
  /** Identifies a process */
  pid: string
  /** Identifies this message */
  id: string
  /** A counter that increments by 1, representing steps of a process */
  sequence: number
  /** A key used to encrypt a reply with */
  key: string
  /** Contents of a message as JSON string */
  message: JSONString<T>
  /** Schema of a message */
  schema: Schema
  /** Hash derived from the schema */
  schemaHash: string
}

/**
 * Logical view of Data with deserialized message.
 * This represents data after the message has been parsed from JSON.
 * Use this type when working with the actual message object.
 *
 * @template T - The type of the deserialized message
 */
export interface Data<T = unknown> {
  /** Identifies a process */
  pid: string
  /** Identifies this message */
  id: string
  /** A counter that increments by 1, representing steps of a process */
  sequence: number
  /** A key used to encrypt a reply with */
  key: string
  /** Contents of a message (deserialized) */
  message: T
  /** Schema of a message */
  schema: Schema
  /** Hash derived from the schema */
  schemaHash: string
}

/**
 * Creates SerializedData from a message.
 * Returns the wire format with JSON-serialized message.
 */
export type DataCreater = <T = unknown>(pid: string, sequence: number, message: T) => Promise<SerializedData<T>>

export type SchemaCreater = (data: unknown) => Schema

/**
 * Encrypts SerializedData to binary format.
 * Takes the wire format (with JSON string message) and encrypts it.
 */
export type DataEncrypter = <T = unknown>(data: SerializedData<T>, password: string) => Promise<Uint8Array>

/**
 * Decrypts binary data back to SerializedData.
 * Returns the wire format with JSON string message.
 */
export type DataDecrypter = <T = unknown>(data: Uint8Array, password: string) => Promise<SerializedData<T>>

/**
 * Type guard to check if a value is a JSONString.
 */
export function isJSONString<T = unknown>(value: unknown): value is JSONString<T> {
  return typeof value === 'string'
}

/**
 * Safely cast a string to JSONString after validation.
 * Use this when you know the string is valid JSON.
 */
export function asJSONString<T = unknown>(value: string): JSONString<T> {
  return value as JSONString<T>
}

/**
 * Parse a JSONString back to its original type.
 */
export function parseJSONString<T>(jsonString: JSONString<T>): T {
  return JSON.parse(jsonString) as T
}

/**
 * Convert SerializedData to Data by parsing the message.
 */
export function deserializeData<T>(serialized: SerializedData<T>): Data<T> {
  return {
    ...serialized,
    message: parseJSONString(serialized.message),
  }
}

/**
 * Convert Data to SerializedData by stringifying the message.
 */
export function serializeData<T>(data: Data<T>): SerializedData<T> {
  return {
    ...data,
    message: asJSONString<T>(JSON.stringify(data.message)),
  }
}
