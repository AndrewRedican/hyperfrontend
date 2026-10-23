/**
 * The DOM property names React knows: the attribute names it renames, the properties allowed on
 * some tags only, the names it accepts whatever their case, the ARIA attributes, and every
 * property name it accepts on a DOM element, with those that came and went with its versions.
 *
 * @module rules/react/shared/dom-properties
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * The words of a whitespace-separated list.
 *
 * @param list - The names, separated by spaces or line breaks
 * @returns The names in order
 */
function words(list: string): string[] {
  return list.split(/\s+/).filter((word) => word !== '')
}

/**
 * The property name React uses for a hyphenated or namespaced SVG attribute: each `-` or `:`
 * dropped and the letter after it upper-cased.
 *
 * @param name - The attribute name as SVG writes it
 * @returns The camel-cased name
 */
function camelCased(name: string): string {
  let result = ''
  for (let index = 0; index < name.length; index += 1) {
    const character = name[index] as string
    if (character === '-' || character === ':') {
      index += 1
      result += (name[index] as string).toUpperCase()
    } else {
      result += character
    }
  }
  return result
}

/** The SVG attributes React spells in camel case. */
const SVG_ATTRIBUTES = words(`
  accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation
  color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule
  flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight
  glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering
  letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order
  panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position
  strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit
  stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness
  unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y
  vert-origin-x vert-origin-y word-spacing writing-mode x-height xlink:actuate xlink:arcrole xlink:href xlink:role
  xlink:show xlink:title xlink:type xml:base xml:lang xml:space
`)

/** HTML and SVG attribute names React renames, with the name it uses. */
export const RENAMED = createMap<string, string>([
  ['accept-charset', 'acceptCharset'],
  ['class', 'className'],
  ['http-equiv', 'httpEquiv'],
  ['crossorigin', 'crossOrigin'],
  ['for', 'htmlFor'],
  ['nomodule', 'noModule'],
  ...SVG_ATTRIBUTES.map((name): [string, string] => [name, camelCased(name)]),
])

/** The tags each tag-specific property is allowed on, listed as the message lists them. */
export const TAGS_BY_PROPERTY = createMap<string, readonly string[]>(
  [
    ['abbr', 'th td'],
    ['charset', 'meta'],
    ['checked', 'input'],
    ['crossOrigin', 'script img video audio link image'],
    ['displaystyle', 'math'],
    ['download', 'a area'],
    [
      'fill',
      'altGlyph circle ellipse g line marker mask path polygon polyline rect svg symbol text textPath tref tspan use animate animateColor animateMotion animateTransform set',
    ],
    ['focusable', 'svg'],
    ['imageSizes', 'link'],
    ['imageSrcSet', 'link'],
    ['property', 'meta'],
    ['viewBox', 'marker pattern svg symbol view'],
    ['as', 'link'],
    ['align', 'applet caption col colgroup hr iframe img table tbody td tfoot th thead tr'],
    ['valign', 'tr td th thead tbody tfoot colgroup col'],
    ['noModule', 'script'],
    ['onAbort', 'audio video'],
    ['onCancel', 'dialog'],
    ['onCanPlay', 'audio video'],
    ['onCanPlayThrough', 'audio video'],
    ['onClose', 'dialog'],
    ['onDurationChange', 'audio video'],
    ['onEmptied', 'audio video'],
    ['onEncrypted', 'audio video'],
    ['onEnded', 'audio video'],
    ['onError', 'audio video img link source script picture iframe'],
    ['onLoad', 'script img link picture iframe object source'],
    ['onLoadedData', 'audio video'],
    ['onLoadedMetadata', 'audio video'],
    ['onLoadStart', 'audio video'],
    ['onPause', 'audio video'],
    ['onPlay', 'audio video'],
    ['onPlaying', 'audio video'],
    ['onProgress', 'audio video'],
    ['onRateChange', 'audio video'],
    ['onResize', 'audio video'],
    ['onSeeked', 'audio video'],
    ['onSeeking', 'audio video'],
    ['onStalled', 'audio video'],
    ['onSuspend', 'audio video'],
    ['onTimeUpdate', 'audio video'],
    ['onVolumeChange', 'audio video'],
    ['onWaiting', 'audio video'],
    ['autoPictureInPicture', 'video'],
    ['controls', 'audio video'],
    ['controlsList', 'audio video'],
    ['disablePictureInPicture', 'video'],
    ['disableRemotePlayback', 'audio video'],
    ['loop', 'audio video'],
    ['muted', 'audio video'],
    ['playsInline', 'video'],
    ['allowFullScreen', 'iframe video'],
    ['webkitAllowFullScreen', 'iframe video'],
    ['mozAllowFullScreen', 'iframe video'],
    ['poster', 'video'],
    ['preload', 'audio video'],
    ['scrolling', 'iframe'],
    ['returnValue', 'dialog'],
    ['webkitDirectory', 'input'],
  ].map(([property, tags]): [string, readonly string[]] => [property as string, words(tags as string)])
)

/** The names React accepts in any case, in the case it is read as. */
export const ANY_CASE = words('charset allowFullScreen webkitAllowFullScreen mozAllowFullScreen webkitDirectory')

/** The ARIA attributes. */
export const ARIA = createSet<string>(
  words(`
    aria-atomic aria-braillelabel aria-brailleroledescription aria-busy aria-controls aria-current aria-describedby
    aria-description aria-details aria-disabled aria-dropeffect aria-errormessage aria-flowto aria-grabbed aria-haspopup
    aria-hidden aria-invalid aria-keyshortcuts aria-label aria-labelledby aria-live aria-owns aria-relevant
    aria-roledescription aria-autocomplete aria-checked aria-expanded aria-level aria-modal aria-multiline
    aria-multiselectable aria-orientation aria-placeholder aria-pressed aria-readonly aria-required aria-selected aria-sort
    aria-valuemax aria-valuemin aria-valuenow aria-valuetext aria-activedescendant aria-colcount aria-colindex
    aria-colindextext aria-colspan aria-posinset aria-rowcount aria-rowindex aria-rowindextext aria-rowspan aria-setsize
  `)
)

/** The property names of multiple words, looked up before the single words. */
const MULTI_WORD = words(`
  accessKey autoCapitalize autoFocus contentEditable enterKeyHint exportParts inputMode itemID itemRef itemProp itemScope
  itemType spellCheck tabIndex acceptCharset autoComplete autoPlay border cellPadding cellSpacing classID codeBase colSpan
  contextMenu dateTime encType formAction formEncType formMethod formNoValidate formTarget frameBorder hrefLang httpEquiv
  imageSizes imageSrcSet isMap keyParams keyType marginHeight marginWidth maxLength mediaGroup minLength noValidate
  onAnimationEnd onAnimationIteration onAnimationStart onBlur onChange onClick onContextMenu onCopy onCompositionEnd
  onCompositionStart onCompositionUpdate onCut onDoubleClick onDrag onDragEnd onDragEnter onDragExit onDragLeave onError
  onFocus onInput onKeyDown onKeyPress onKeyUp onLoad onWheel onDragOver onDragStart onDrop onMouseDown onMouseEnter
  onMouseLeave onMouseMove onMouseOut onMouseOver onMouseUp onPaste onScroll onSelect onSubmit onToggle onTransitionEnd
  radioGroup readOnly referrerPolicy rowSpan srcDoc srcLang srcSet useMap fetchPriority
  crossOrigin accentHeight alignmentBaseline arabicForm attributeName attributeType baseFrequency baselineShift
  baseProfile calcMode capHeight clipPathUnits clipPath clipRule colorInterpolation colorInterpolationFilters colorProfile
  colorRendering contentScriptType contentStyleType diffuseConstant dominantBaseline edgeMode enableBackground fillOpacity
  fillRule filterRes filterUnits floodColor floodOpacity fontFamily fontSize fontSizeAdjust fontStretch fontStyle
  fontVariant fontWeight glyphName glyphOrientationHorizontal glyphOrientationVertical glyphRef gradientTransform
  gradientUnits horizAdvX horizOriginX imageRendering kernelMatrix kernelUnitLength keyPoints keySplines keyTimes
  lengthAdjust letterSpacing lightingColor limitingConeAngle markerEnd markerMid markerStart markerHeight markerUnits
  markerWidth maskContentUnits maskUnits mathematical numOctaves overlinePosition overlineThickness panose1 paintOrder
  pathLength patternContentUnits patternTransform patternUnits pointerEvents pointsAtX pointsAtY pointsAtZ preserveAlpha
  preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures
  shapeRendering specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles stopColor stopOpacity
  strikethroughPosition strikethroughThickness strokeDasharray strokeDashoffset strokeLinecap strokeLinejoin
  strokeMiterlimit strokeOpacity strokeWidth surfaceScale systemLanguage tableValues targetX targetY textAnchor
  textDecoration textRendering textLength transformOrigin underlinePosition underlineThickness unicodeBidi unicodeRange
  unitsPerEm vAlphabetic vHanging vIdeographic vMathematical vectorEffect vertAdvY vertOriginX vertOriginY viewBox
  viewTarget wordSpacing writingMode xHeight xChannelSelector xlinkActuate xlinkArcrole xlinkHref xlinkRole xlinkShow
  xlinkTitle xlinkType xmlBase xmlLang xmlnsXlink xmlSpace yChannelSelector zoomAndPan
  autoCorrect autoSave className dangerouslySetInnerHTML defaultValue defaultChecked htmlFor
  onBeforeInput onInvalid onReset onTouchCancel onTouchEnd onTouchMove onTouchStart suppressContentEditableWarning
  suppressHydrationWarning onAbort onCanPlay onCanPlayThrough onDurationChange onEmptied onEncrypted onEnded onLoadedData
  onLoadedMetadata onLoadStart onPause onPlay onPlaying onProgress onRateChange onResize onSeeked onSeeking onStalled
  onSuspend onTimeUpdate onVolumeChange onWaiting onCopyCapture onCutCapture onPasteCapture onCompositionEndCapture
  onCompositionStartCapture onCompositionUpdateCapture onFocusCapture onBlurCapture onChangeCapture onBeforeInputCapture
  onInputCapture onResetCapture onSubmitCapture onInvalidCapture onLoadCapture onErrorCapture onKeyDownCapture
  onKeyPressCapture onKeyUpCapture onAbortCapture onCanPlayCapture onCanPlayThroughCapture onDurationChangeCapture
  onEmptiedCapture onEncryptedCapture onEndedCapture onLoadedDataCapture onLoadedMetadataCapture onLoadStartCapture
  onPauseCapture onPlayCapture onPlayingCapture onProgressCapture onRateChangeCapture onSeekedCapture onSeekingCapture
  onStalledCapture onSuspendCapture onTimeUpdateCapture onVolumeChangeCapture onWaitingCapture onSelectCapture
  onTouchCancelCapture onTouchEndCapture onTouchMoveCapture onTouchStartCapture onScrollCapture onWheelCapture
  onAnimationEndCapture onAnimationStartCapture onTransitionEndCapture onAuxClick onAuxClickCapture
  onClickCapture onContextMenuCapture onDoubleClickCapture onDragCapture onDragEndCapture onDragEnterCapture
  onDragExitCapture onDragLeaveCapture onDragOverCapture onDragStartCapture onDropCapture onMouseDownCapture
  onMouseMoveCapture onMouseOutCapture onMouseOverCapture onMouseUpCapture
  autoPictureInPicture controlsList disablePictureInPicture disableRemotePlayback
`)

/** The property names of one word. */
const ONE_WORD = words(`
  dir draggable hidden id lang nonce part slot style title translate inert
  accept action allow alt as async buffered capture challenge cite code cols content coords csp data decoding default
  defer disabled form headers height high href icon importance integrity kind label language loading list loop low
  manifest max media method min multiple muted name open optimum pattern ping placeholder poster preload profile rel
  required reversed role rows sandbox scope seamless selected shape size sizes span src start step summary target type
  value width wmode wrap
  accumulate additive alphabetic amplitude ascent azimuth bbox begin bias by clip color cursor cx cy d decelerate descent
  direction display divisor dur dx dy elevation end exponent fill filter format from fr fx fy g1 g2 hanging hreflang
  ideographic in in2 intercept k k1 k2 k3 k4 kerning local mask mode offset opacity operator order orient orientation
  origin overflow path points r radius restart result rotate rx ry scale seed slope spacing speed stemh stemv string stroke to transform u1 u2
  unicode values version visibility widths x x1 x2 xmlns y y1 y2 z
  property ref key children results security controls popover popovertarget popovertargetaction
`)

/** The pointer event properties React added in 16.4. */
const POINTER_EVENTS = words(`
  onGotPointerCapture onGotPointerCaptureCapture onLostPointerCapture onLostPointerCaptureCapture onPointerCancel
  onPointerCancelCapture onPointerDown onPointerDownCapture onPointerEnter onPointerEnterCapture onPointerLeave
  onPointerLeaveCapture onPointerMove onPointerMoveCapture onPointerOut onPointerOutCapture onPointerOver
  onPointerOverCapture onPointerUp onPointerUpCapture
`)

/**
 * A lookup from a lower-cased name to the first name of a list it lower-cases to.
 *
 * @param names - The names, in lookup order
 * @returns The lookup
 */
function byLowerCase(names: readonly string[]): Map<string, string> {
  const lookup = createMap<string, string>()
  for (const name of names) if (!lookup.has(name.toLowerCase())) lookup.set(name.toLowerCase(), name)
  return lookup
}

/** Every property name React accepts on a DOM element in every version, by its lower-cased form. */
export const PROPERTIES = byLowerCase([...MULTI_WORD, ...ONE_WORD])

/** The pointer event properties, by their lower-cased forms. */
export const POINTER_PROPERTIES = byLowerCase(POINTER_EVENTS)
