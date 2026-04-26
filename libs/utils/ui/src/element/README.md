# element

DOM element creation, retrieval, and dimension-tracking helpers.

`createElement` builds a configured element from an `ElementConfig` (tag, attributes, children, listeners) and returns it with `ElementMethods` attached for fluent updates. The per-tag shortcuts (`div`, `span`, `button`, `input`, `img`, `paragraph`, `header`, `section`, `unorderedList`, table-cell helpers, etc.) are pre-bound versions of `createElement` for the common HTML tags. `getElementAsync` resolves an element by ref or selector once it appears in the DOM, with `OnSuccess`/`OnFail` callbacks for the timeout case. `onElementResize` registers an `ElementResizeCallback` against `ResizeObserver` to track dimension changes without polling.
