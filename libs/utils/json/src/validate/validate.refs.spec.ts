import type { Schema } from '../types/schema'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validate } from './validate'

describe('validate $ref cycles', () => {
  const circular = (ref: string) => expect.objectContaining({ code: '$ref', path: '/', params: { ref } })

  it('reports a definition that refers to itself', () => {
    const schema: Schema = { definitions: { node: { $ref: '#/definitions/node' } }, $ref: '#/definitions/node' }

    expect(validate({}, schema)).toEqual({ valid: false, errors: [circular('#/definitions/node')] })
  })

  it('reports a root that refers to itself', () => {
    const schema: Schema = { $ref: '#' }

    expect(validate({}, schema)).toEqual({ valid: false, errors: [circular('#')] })
  })

  it('reports a root that refers to itself through allOf', () => {
    const schema: Schema = { allOf: [{ $ref: '#' }] }

    expect(validate({}, schema)).toEqual({ valid: false, errors: [circular('#')] })
  })

  it('reports a two-step cycle between definitions', () => {
    const schema: Schema = {
      definitions: { a: { $ref: '#/definitions/b' }, b: { $ref: '#/definitions/a' } },
      $ref: '#/definitions/a',
    }

    expect(validate({}, schema)).toEqual({ valid: false, errors: [circular('#/definitions/a')] })
  })

  it('reports the cycle at the position where it stops consuming data', () => {
    const schema: Schema = {
      type: 'object',
      properties: { child: { $ref: '#/definitions/loop' } },
      definitions: { loop: { $ref: '#/definitions/loop' } },
    }

    expect(validate({ child: {} }, schema).errors).toEqual([expect.objectContaining({ code: '$ref', path: '/child' })])
  })

  it('stops after the first cycle error when collectAllErrors is false', () => {
    const schema: Schema = { allOf: [{ $ref: '#' }, { $ref: '#' }] }

    expect(validate({}, schema, { collectAllErrors: false }).errors).toHaveLength(1)
  })
})

describe('validate recursive schemas', () => {
  const tree: Schema = {
    definitions: {
      node: {
        type: 'object',
        properties: { value: { type: 'integer' }, children: { type: 'array', items: { $ref: '#/definitions/node' } } },
        required: ['value', 'children'],
      },
    },
    $ref: '#/definitions/node',
  }

  it('validates data-bounded recursion through items', () => {
    const data = {
      value: 1,
      children: [
        { value: 2, children: [{ value: 3, children: [] }] },
        { value: 4, children: [] },
      ],
    }

    expect(validate(data, tree)).toEqual({ valid: true, errors: [] })
  })

  it('reports leaf failures deep inside the recursion', () => {
    const data = { value: 1, children: [{ value: 'x', children: [] }] }

    expect(validate(data, tree).errors).toEqual([expect.objectContaining({ code: 'type', path: '/children/0/value' })])
  })

  it('lets sibling branches reuse the same $ref at one position', () => {
    const schema: Schema = { definitions: { s: { type: 'string' } }, allOf: [{ $ref: '#/definitions/s' }, { $ref: '#/definitions/s' }] }

    expect(validate('x', schema)).toEqual({ valid: true, errors: [] })
  })

  it('follows a $ref chain that ends without looping', () => {
    const schema: Schema = { definitions: { a: { $ref: '#/definitions/b' }, b: { type: 'string' } }, $ref: '#/definitions/a' }

    expect(validate(1, schema).errors).toEqual([expect.objectContaining({ code: 'type' })])
  })
})
