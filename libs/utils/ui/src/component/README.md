# component

Styled DOM-component factory: pairs a creator function with a styling function for one self-contained component definition.

`component(create, style)` accepts a `CreateFn` that builds the DOM tree and a `StyleFn` that produces the per-instance CSS. The returned factory pairs the two so callers get a single function that yields a styled element ready to mount. Designed for small, framework-agnostic components in static pages, demos, and DOM-driven utilities — pick a real framework when you need lifecycle, state, or reactivity.
