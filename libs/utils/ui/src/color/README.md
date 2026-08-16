# color

Color-format conversion and variation helpers for hex / RGB workflows.

`hexToRgb` parses a hex string into an `Rgb` shape; `rgbToHex` and `rgbStringToHex` go the other way. `rgbToString` formats an `Rgb` for use in CSS color properties. `getColorVariation` produces a lightened or darkened shade of an input color: useful for hover/active states, theme generation, or any case where you want a derived color without committing to a full palette.
