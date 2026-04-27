# selector

CSS-selector builder, validators, and DOM-query shortcuts that produce safer selectors than ad-hoc string concatenation.

`CssSelector` is a fluent builder for composing selectors out of tag, id, class, and attribute parts; the validator family (`validateCssName`, `validateStringArgument`, `validateIdSelector`, `validateClassSelector`, `validateAttributeSelector`, `isValidCssSelector`) rejects inputs that would produce malformed or surprising selectors before they reach the DOM. The query helpers (`select`, `selectBy`, `selectByElement`, `selectAllElements`, `selectById`, `selectByClass`, `selectByAttribute`) wrap `querySelector` / `querySelectorAll` so callers don't have to repeat the boilerplate or remember the typed return shapes.
