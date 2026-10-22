import { describe, expect, it } from '@hyperfrontend/testing'
import { parseJsdoc } from '../../../jsdoc/parse.ts'
import { parseType } from '../../../jsdoc/types.ts'
import { isCheckedName, typedTags, typeVisits } from './type-walk.ts'

/**
 * The visits of a type expression.
 *
 * @param text - The expression
 * @returns The kind, value and field of each node visited
 */
function visits(text: string): string[] {
  return typeVisits(parseType(text).node as NonNullable<ReturnType<typeof parseType>['node']>).map(
    (visit) => `${visit.node.kind}:${visit.node.value ?? ''}:${visit.field ?? 'root'}:${isCheckedName(visit)}`
  )
}

describe('typeVisits', () => {
  it('visits a generic head and its arguments', () => {
    expect(visits('A<B>')).toEqual(['generic::root:false', 'name:A:left:true', 'name:B:elements:true'])
  })

  it('leaves the member after a path dot unchecked', () => {
    expect(visits('A.B')).toEqual(['namePath:.:root:false', 'name:A:left:true', 'name:B:right:false'])
  })

  it('visits every branch of a conditional', () => {
    expect(visits('A extends B ? C : D').map((item) => item.split(':')[2])).toEqual(['root', 'left', 'right', 'third', 'fourth'])
  })
})

describe('typedTags', () => {
  it('keeps the tags whose type parses, leaving imports out', () => {
    const text = '/**\n * @param {A} a\n * @param {A<} b\n * @import {B} from "c"\n * @see x\n */'
    const block = parseJsdoc(text, 0, text.length, [0, 4, 19, 35, 58, 66])
    expect(typedTags(block).map(({ tag }) => tag.name)).toEqual(['a'])
  })
})
