class Foo {
  static // comment
  {
    Foo.ready = true
  }
  static ready = false
}
const settings = { get name () { return 'a' }, set name (value) {}, run () {}, async *gen () {} }
function plain() {
  yield 1
  yield
}
const literal = <const>{ bar: 5 }
const typed = b as const.Foo<number>
const made = new (Generic<string> as Foo)()
const kept = Generic<string> satisfies Foo
@State<Partial<Model>>
({ name: 'settings' })
class Settings {}
@Plain<Model>
class Other {}
𠮷𩸽.𠮷 = 1
tag`\8`
1
'use strict'
function prologue() {
  'use strict'
  ;('not a directive')
}
{
  'in a block'
}
