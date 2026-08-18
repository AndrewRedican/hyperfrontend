# How to fix "Converting circular structure to JSON"

You will find every loop in a value, not just the first one the engine names, and get a copy that serialises while the original graph stays intact.

V8 tells you where one loop closes and stops there. Fix that edge and the next throw names the next one, which is why this usually takes several rounds. [`@hyperfrontend/data-utils`](/docs/libraries/utils/data) reports all of them at once and copies around them.

Take an order whose lines point back at the order, and whose customer remembers its last one:

```ts
const order = { id: 'ord_412', total: 88, customer: { id: 'cus_7', name: 'Ada' }, lines: [] }
order.lines.push({ sku: 'HF-1', qty: 2, order })
order.lines.push({ sku: 'HF-2', qty: 1, order })
order.customer.lastOrder = order
```

Three loops. [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) names one:

```text
TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Object'
    |     property 'customer' -> object with constructor 'Object'
    --- property 'lastOrder' closes the circle
```

## 1. Install it

```bash
npm install @hyperfrontend/data-utils
```

## 2. Confirm which value carries the loop

When the throw comes from inside a logger or a fetch wrapper, the value in the stack trace is often not the one you handed it. [`hasCircularReference`](/docs/libraries/utils/data#api-hasCircularReference) answers for any value, and returns false on a primitive rather than throwing:

```ts
import { hasCircularReference } from '@hyperfrontend/data-utils'

hasCircularReference(order) // true
hasCircularReference(order.customer.name) // false
```

## 3. Find every edge that closes a loop

[`locateCircularReference`](/docs/libraries/utils/data#api-locateCircularReference) returns one loop by default. Pass `'*'` for all of them:

```ts
import { locateCircularReference } from '@hyperfrontend/data-utils'

const loops = locateCircularReference(order, '*')

loops.map(String)
// ['customer·lastOrder → ', 'lines·0·order → ', 'lines·1·order → ']
```

Each entry is a [`CircularReference`](/docs/libraries/utils/data#api-CircularReference). Its `location.path` is the property that closes the loop and its `target.path` is where that property points, empty when the target is the value you passed in:

```ts
loops[0].location.path // ['customer', 'lastOrder']
loops[0].target.path // []
```

## 4. Copy without those edges

[`selectiveCopy`](/docs/libraries/utils/data#api-selectiveCopy) walks the value and hands each property to your predicate as `(value, path)`, where `path` ends with the property's own key. That is the same shape `location.path` gave you, so the two match directly:

```ts
import { selectiveCopy } from '@hyperfrontend/data-utils'

const cyclic = new Set(loops.map((loop) => loop.location.path.join(' ')))

const { clone, skipped } = selectiveCopy(order, {
  exclude: (value, path) => cyclic.has(path.join(' ')),
})

JSON.stringify(clone)
// '{"id":"ord_412","total":88,"customer":{"id":"cus_7","name":"Ada"},"lines":[{"sku":"HF-1","qty":2},{"sku":"HF-2","qty":1}]}'
```

`order` still has all three back references. [`skipped`](/docs/libraries/utils/data#api-SelectiveCopyResult-prop-skipped) lists what the copy left out, one entry per dropped property, so a log line or a test can assert on the exact set rather than on a diff:

```ts
skipped.map((point) => point.path.join('.'))
// ['customer.lastOrder', 'lines.0.order', 'lines.1.order']
```

Give the predicate to [`exclude`](/docs/libraries/utils/data#api-SelectiveCopyOptions-prop-exclude), not to [`excludeKeys`](/docs/libraries/utils/data#api-SelectiveCopyOptions-prop-excludeKeys): the key lists apply to the top level only, so a loop nested any deeper stays in and the copy recurses until the stack runs out.

## 5. Put a pointer where the edge was

Dropping the property loses the relationship. Writing the target's path in its place keeps it, in a form JSON can carry and the receiving end can follow:

```ts
for (const { location, target } of loops) {
  const key = location.path[location.path.length - 1]
  const parent = location.path.slice(0, -1).reduce((node, step) => node[step], clone)
  parent[key] = `/${target.path.join('/')}`
}

JSON.stringify(clone)
// '{"id":"ord_412","total":88,"customer":{"id":"cus_7","name":"Ada","lastOrder":"/"},"lines":[{"sku":"HF-1","qty":2,"order":"/"},{"sku":"HF-2","qty":1,"order":"/"}]}'
```

## Check it worked

`hasCircularReference(clone)` is false and `JSON.stringify(clone)` returns a string. `hasCircularReference(order)` is still true, and every property you started with is still on it. Add another back reference anywhere in the graph and rerun: it shows up in `skipped`, the copy still serialises, and none of the code above changes.

## Limits

The copier walks plain objects and arrays. A [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), a [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), or a class instance is copied as a plain object, which for a `Date` means an empty one. Convert those to a plain value on the way in, for example an ISO string, or set them on the clone the same way step 5 sets its pointers.
