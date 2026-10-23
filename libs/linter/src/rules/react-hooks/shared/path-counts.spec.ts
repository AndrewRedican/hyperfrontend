import type { Node } from '../../../code/model'
import type { CodePath, Segment } from '../../../flow/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../../../code/parse'
import { analyzeFlow } from '../../../flow/analysis'
import { PathCounter } from './path-counts'

/**
 * The code path of the first function in a text.
 *
 * @param text - The text, a function declaration first
 * @returns The function's code path
 */
function functionPath(text: string): CodePath {
  const tree = parseCode(text, '.ts').tree as Node
  return analyzeFlow(tree).paths[1] as CodePath
}

/**
 * A segment of a path by its position.
 *
 * @param path - The code path
 * @param index - The segment's position among the path's segments
 * @returns The segment at that position
 */
function segmentAt(path: CodePath, index: number): Segment {
  return path.segments[index] as Segment
}

describe('PathCounter over an if without else', () => {
  const path = functionPath('function f() { if (a) { b() } }')
  it('counts both ways through as paths', () => {
    expect(new PathCounter(path).toEnd(path.initial)).toBe(2n)
  })
  it('counts one path through the branch', () => {
    const counter = new PathCounter(path)
    expect(counter.fromStart(segmentAt(path, 1)) * counter.toEnd(segmentAt(path, 1))).toBe(1n)
  })
  it('reads the branch as joining the end', () => {
    expect(new PathCounter(path).endsAt(segmentAt(path, 1))).toBe(false)
  })
  it('places the joined end one past the nearest falling segment', () => {
    expect(new PathCounter(path).shortestFinalDistance()).toBe(2)
  })
})

describe('PathCounter over a straight function', () => {
  const path = functionPath('function f() { a() }')
  it('ends at its only segment', () => {
    expect(new PathCounter(path).endsAt(path.initial)).toBe(true)
  })
  it('measures its only segment as the end', () => {
    expect(new PathCounter(path).shortestFinalDistance()).toBe(1)
  })
  it('reuses a counted path from the start', () => {
    const counter = new PathCounter(path)
    counter.fromStart(path.initial)
    expect(counter.fromStart(path.initial)).toBe(1n)
  })
  it('reuses a measured distance', () => {
    const counter = new PathCounter(path)
    counter.distanceToStart(path.initial)
    expect(counter.distanceToStart(path.initial)).toBe(1)
  })
})

describe('PathCounter over returns', () => {
  const path = functionPath('function f() { if (a) return b && c; d() }')
  it('measures the nearest final segment, the one falling off the end', () => {
    expect(new PathCounter(path).shortestFinalDistance()).toBe(2)
  })
  it('counts every way to the end', () => {
    expect(new PathCounter(path).toEnd(path.initial)).toBe(3n)
  })
})

describe('PathCounter over a loop', () => {
  const path = functionPath('function f() { while (a) { b() } }')
  it('records the loop as a cycle when counting to the end', () => {
    const counter = new PathCounter(path)
    counter.toEnd(path.initial)
    expect([...counter.cyclic].length > 0).toBe(true)
  })
  it('records the last segment when the cycle closes on the first visited', () => {
    const counter = new PathCounter(path)
    const test = segmentAt(path, 1)
    counter.toEnd(test)
    expect(counter.cyclic.has(segmentAt(path, 2).id)).toBe(true)
  })
  it('counts no path back around the loop from the start', () => {
    expect(new PathCounter(path).fromStart(segmentAt(path, 2))).toBe(1n)
  })
  it('measures through the loop entry', () => {
    expect(new PathCounter(path).distanceToStart(segmentAt(path, 2))).toBe(3)
  })
})

describe('PathCounter over a throw', () => {
  const path = functionPath('function f() { throw a }')
  it('counts no path to the end', () => {
    expect(new PathCounter(path).toEnd(path.initial)).toBe(0n)
  })
  it('counts no path from the start', () => {
    expect(new PathCounter(path).fromStart(path.initial)).toBe(0n)
  })
})
