# style

Dynamic CSS authoring helpers: per-element style application and runtime stylesheet management.

`createApplyStyle` and `createApplyStyles` produce reusable functions that apply a `Style` or `StyleMap` to one or many target elements — useful when the same style block is applied repeatedly. `cssRule` and `cssRules` build CSS rule strings from object literals; `cssObjectToString` is the lower-level converter from a `Style` object to its CSS representation. `addStylesheet` and `removeStylesheet` mount and unmount `<style>` elements at runtime, so dynamic themes and feature-flagged styles can be inserted without touching the DOM by hand.
