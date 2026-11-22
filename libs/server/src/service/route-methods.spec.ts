import { METHODS } from 'node:http'
import { describe, expect, it } from '@hyperfrontend/testing'
import { ROUTE_METHODS, methodProblem } from './route-methods'

const METHOD_RULE = 'the method must be one of GET, HEAD, POST, PUT, PATCH, DELETE, QUERY, OPTIONS.'
const UNPARSED = 'the method QUERY is not parsed by this version of Node.js.'
const WITHOUT_QUERY = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']
const WITH_QUERY = [...WITHOUT_QUERY, 'QUERY']

describe('ROUTE_METHODS', () => {
  it('lists the methods in the order of an Allow header, QUERY between DELETE and OPTIONS', () => {
    expect(ROUTE_METHODS).toEqual(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'OPTIONS'])
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ROUTE_METHODS)).toBe(true)
  })
})

describe('methodProblem', () => {
  it.each([['get'], ['query'], ['TRACE'], ['CONNECT'], [undefined], [null], [7], [Symbol('GET')]])(
    'refuses %p, which no route may name, whatever the runtime parses',
    (method) => {
      expect(methodProblem(method, ['TRACE', 'CONNECT', 'get', 'query'])).toBe(METHOD_RULE)
    }
  )

  it.each(ROUTE_METHODS.map((method) => [method]))('accepts %p on a runtime whose parser knows it', (method) => {
    expect(methodProblem(method, WITH_QUERY)).toBeNull()
  })

  it('refuses QUERY on a runtime whose parser does not know it', () => {
    expect(methodProblem('QUERY', WITHOUT_QUERY)).toBe(UNPARSED)
  })

  it.each([['GET'], ['HEAD'], ['POST'], ['PUT'], ['PATCH'], ['DELETE'], ['OPTIONS']])(
    'accepts %p on a runtime whose parser does not know QUERY',
    (method) => {
      expect(methodProblem(method, WITHOUT_QUERY)).toBeNull()
    }
  )

  it('reads the methods of the running Node.js when it is given no runtime', () => {
    expect(methodProblem('QUERY')).toBe(METHODS.includes('QUERY') ? null : UNPARSED)
  })

  it('accepts GET on the running Node.js', () => {
    expect(methodProblem('GET')).toBeNull()
  })
})
