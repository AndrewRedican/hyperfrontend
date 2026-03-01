/* eslint-disable @typescript-eslint/no-empty-function */
import { deregisterClassTypes } from './deregister-class-types'
import { getType } from './get-type'
import { registerClassTypes } from './register-class-types'

describe('getType', () => {
  it('returns "undefined" for a reference explicitely set to undefined', () => {
    expect(getType(undefined)).toBe('undefined')
  })

  it('returns "undefined" for a reference explicitely set to void 0', () => {
    expect(getType(void 0)).toBe('undefined')
  })

  it('returns "undefined" for a reference that does not exist', () => {
    // @ts-expect-error TS2339
    expect(getType({}.a)).toBe('undefined')
  })

  it('returns "boolean" for a reference set to true', () => {
    expect(getType(true)).toBe('boolean')
  })

  it('returns "boolean" for a reference set to false', () => {
    expect(getType(false)).toBe('boolean')
  })

  it('returns "number" for a reference set to a natural positive number', () => {
    expect(getType(42)).toBe('number')
  })

  it('returns "number" for a reference set to a negative number', () => {
    expect(getType(-3)).toBe('number')
  })

  it('returns "number" for a reference set to zero', () => {
    expect(getType(0)).toBe('number')
  })

  it('returns "number" for a reference set to a decimal', () => {
    expect(getType(3.14)).toBe('number')
  })

  it('returns "number" for a reference set to a fraction', () => {
    expect(getType(1 / 3)).toBe('number')
  })

  it('returns "number" for a reference set to Infinity', () => {
    expect(getType(Infinity)).toBe('number')
  })

  it('returns "number" for a reference set to -Infinity', () => {
    expect(getType(-Infinity)).toBe('number')
  })

  it('returns "number" for a reference set to NaN', () => {
    expect(getType(NaN)).toBe('number')
  })

  it('does not return "number" for a reference set string containing a number', () => {
    expect(getType('42')).not.toBe('number')
  })

  it('returns "bigint" for a reference set to BigInt(900719925471991)', () => {
    expect(getType(BigInt(900719925471991))).toBe('bigint')
  })

  it('returns "bigint" for a reference set to a bigint literal', () => {
    expect(getType(900719925471991n)).toBe('bigint')
  })

  it('returns "bigint" for a reference set to BigInt from large decimal string', () => {
    expect(getType(BigInt('123456789012345678901234567890'))).toBe('bigint')
  })

  it('returns "bigint" for a reference set to BigInt from binary string', () => {
    expect(getType(BigInt('0b1111111111111111111111111111111111111111111111111111111111111111111'))).toBe('bigint')
  })

  it('returns "bigint" for a reference set to negative BigInt from octal string', () => {
    expect(getType(-BigInt('0o12345670123456701234567012345670'))).toBe('bigint')
  })

  it('returns "string" for a reference set to a string literal', () => {
    expect(getType('hello world')).toBe('string')
  })

  it('returns "string" for a reference set to empty string', () => {
    expect(getType('')).toBe('string')
  })

  it('returns "string" for a reference set to space string', () => {
    expect(getType(' ')).toBe('string')
  })

  it('returns "string" for a reference set to single character', () => {
    expect(getType('c')).toBe('string')
  })

  it('returns "string" for a reference set to another string literal', () => {
    expect(getType('foobar')).toBe('string')
  })

  it('returns "string" for a reference set to template string', () => {
    expect(getType(`template string`)).toBe('string')
  })

  it('returns "string" for a reference set to String from number', () => {
    expect(getType(String(123))).toBe('string')
  })

  it('returns "string" for a reference set to String from true', () => {
    expect(getType(String(true))).toBe('string')
  })

  it('returns "string" for a reference set to String from false', () => {
    expect(getType(String(false))).toBe('string')
  })

  it('returns "null" for a reference set to null', () => {
    expect(getType(null)).toBe('null')
  })

  it('returns "array" for a reference set to empty array literal', () => {
    expect(getType([])).toBe('array')
  })

  it('returns "array" for a reference set to array literal with elements', () => {
    expect(getType([1, 2, 3])).toBe('array')
  })

  it('returns "array" for a reference set to new Array()', () => {
    // eslint-disable-next-line @typescript-eslint/no-array-constructor
    expect(getType(new Array())).toBe('array')
  })

  it('returns "array" for a reference set to new Array with size', () => {
    expect(getType(new Array(5))).toBe('array')
  })

  it('returns "object" for a reference set to a plain object', () => {
    expect(getType({})).toBe('object')
    expect(getType({ a: 1, b: 2 })).toBe('object')
    expect(getType(new Object())).toBe('object')
    expect(getType(Object.create(null))).toBe('object')
  })

  it('returns "object" for a reference to instance of any unregistered class', () => {
    class AnyUnregisteredClass {}
    expect(getType(new AnyUnregisteredClass())).toBe('object')
  })

  it('returns "function" for a reference set to a function declaration', () => {
    expect(getType(function () {})).toBe('function')
  })

  it('returns "function" for a reference set to arrow function', () => {
    expect(getType(() => {})).toBe('function')
  })

  it('returns "function" for a reference set to async function', () => {
    expect(getType(async function () {})).toBe('function')
  })

  it('returns "function" for a reference set to async arrow function', () => {
    expect(getType(async () => {})).toBe('function')
  })

  it('returns "function" for a reference set to generator function', () => {
    expect(getType(function* () {})).toBe('function')
  })

  it('returns "function" for a reference set to async generator function', () => {
    expect(getType(async function* () {})).toBe('function')
  })

  it('returns "function" for a reference set to class', () => {
    expect(getType(class {})).toBe('function')
  })

  it('returns "function" for a reference set to a function using "this." syntax', () => {
    function Func(this: { value: number }) {
      this.value = 42
    }
    expect(getType(Func)).toBe('function')
  })

  it('returns the registered class name for a reference to an instance of a registered class', () => {
    class RegisteredClassA {}
    class RegisteredClassB {}
    registerClassTypes(RegisteredClassA, RegisteredClassB)
    expect(getType(new RegisteredClassA())).toBe('RegisteredClassA')
    expect(getType(new RegisteredClassB())).toBe('RegisteredClassB')
    deregisterClassTypes(RegisteredClassA, RegisteredClassB)
  })
})
