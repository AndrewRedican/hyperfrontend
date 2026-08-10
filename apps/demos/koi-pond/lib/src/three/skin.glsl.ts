/**
 * What the koi's three surfaces look like: skin, membrane and eye.
 *
 * The skin is painted entirely in the koi's own body coordinates, so there is no
 * texture, no UV layout and no seam. Markings sit exactly where the pattern
 * generator put them, the scale relief runs in proper diagonal courses around
 * the flank, and the gill line follows the operculum's real diagonal rather than
 * being a straight cut across the head.
 *
 * The relief is a bump, not geometry: the height field is evaluated per pixel
 * and the normal is bent by its own screen-space gradient. That buys the surface
 * complexity a koi needs at close range for no triangles at all — which is what
 * keeps one koi under four thousand of them.
 */
import { MAX_PATCHES } from '../koi3d/pattern.js'

/** Skin uniforms, the pattern compositor and the scale field. */
export const SKIN_FRAGMENT_COMMON = /* glsl */ `
#define KOI_PATCHES ${MAX_PATCHES}

uniform vec3 uBaseColour;
uniform vec3 uPrimaryColour;
uniform vec3 uSecondaryColour;
uniform vec3 uBellyColour;
uniform vec4 uPatchShape[KOI_PATCHES];
uniform vec4 uPatchStyle[KOI_PATCHES];
uniform float uNetting;
uniform float uMetallicMix;
uniform float uScaleDepth;
uniform float uScaleDensity;
uniform float uGillStation;

float koiScaleEdge;
float koiScaleTone;
float koiVentral;
float koiScaled;

/**
 * The scale lattice: how far inside its own scale a pixel sits, and how that scale is tinted.
 */
vec2 koiScaleField(vec2 body) {
  float rows = max(6.0, uScaleDensity);
  // magic: Offsetting alternate columns by half a row is what turns a grid of blobs into the diagonal courses a fish's scales actually run in.
  vec2 lattice = vec2(body.x * rows * 2.6, body.y * rows);
  // why: A perfect lattice reads as knitted fabric; nudging every cell off the grid is what turns it back into an animal.
  lattice += (vec2(koiNoise(vec2(body.x * 7.0, body.y * 6.0), 6.0), koiNoise(vec2(body.x * 5.0 + 3.0, body.y * 7.0), 7.0)) - 0.5) * 0.6;
  float column = floor(lattice.x);
  lattice.y += mod(column, 2.0) * 0.5;
  vec2 within = fract(lattice) - 0.5;
  // why: A scale is a rounded diamond overlapping its neighbours, not a disc; squaring the metric toward a diamond is what stops the flank reading as bubble wrap.
  float distance = pow(pow(abs(within.x * 1.9), 1.6) + pow(abs(within.y * 1.55), 1.6), 0.625);
  return vec2(smoothstep(0.98, 0.55, distance), koiHash(vec2(column, floor(lattice.y))));
}

/**
 * Bends a normal by the screen-space gradient of a height field.
 */
vec3 koiPerturbNormal(vec3 surface, float height) {
  vec3 alongX = dFdx(-vViewPosition);
  vec3 alongY = dFdy(-vViewPosition);
  vec3 firstCross = cross(alongY, surface);
  vec3 secondCross = cross(surface, alongX);
  float determinant = dot(alongX, firstCross);
  vec3 gradient = sign(determinant) * (dFdx(height) * firstCross + dFdy(height) * secondCross);
  return normalize(abs(determinant) * surface - gradient);
}

/**
 * The colour of the koi's skin at a point on its body.
 */
vec3 koiSkinColour(vec2 body) {
  float warp = koiNoise(vec2(body.x * 9.0, body.y * 8.0), 8.0);
  float grain = koiNoise(vec2(body.x * 27.0, body.y * 22.0), 22.0);

  float primaryMask = 0.0;
  float secondaryMask = 0.0;
  for (int index = 0; index < KOI_PATCHES; index += 1) {
    vec4 shape = uPatchShape[index];
    vec4 style = uPatchStyle[index];
    float alongBody = (body.x - shape.x) / shape.z;
    float aroundBody = koiGirthDelta(body.y, shape.y) / shape.w;
    float turn = style.x;
    vec2 local = vec2(alongBody * cos(turn) - aroundBody * sin(turn), alongBody * sin(turn) + aroundBody * cos(turn));
    // why: Warping the radius rather than the centre is what gives a marking the ragged, scale-by-scale edge a real nishikigoi has, without ever breaking it into islands.
    float radius = length(local) + (warp - 0.5) * style.w + (grain - 0.5) * style.w * 0.3;
    float mask = 1.0 - smoothstep(1.0 - style.y, 1.0 + style.y, radius);
    primaryMask = max(primaryMask, mask * step(style.z, 0.5));
    secondaryMask = max(secondaryMask, mask * step(0.5, style.z));
  }

  koiVentral = 1.0 - smoothstep(0.09, 0.22, abs(koiGirthDelta(body.y, 0.5)));
  vec3 colour = mix(uBaseColour, uBellyColour, koiVentral * 0.85);
  // why: Markings stop at the belly on every real variety, so the ventral mask suppresses them rather than being painted over them.
  colour = mix(colour, uPrimaryColour, primaryMask * (1.0 - koiVentral * 0.85));
  colour = mix(colour, uSecondaryColour, secondaryMask * (1.0 - koiVentral * 0.9));

  vec2 scales = koiScaleField(body);
  // why: A koi's head is scaleless right back to the operculum, and painting scales over it is the single clearest tell that the skin is a texture rather than an animal.
  // why: The relief fades out again over the tail base, where the section has flattened to an edge and the lattice would otherwise alias into a crosshatch against the membrane.
  koiScaled = smoothstep(uGillStation - 0.03, uGillStation + 0.06, body.x) * (1.0 - smoothstep(KOI_CAUDAL_ROOT - 0.055, KOI_CAUDAL_ROOT + 0.02, body.x));
  koiScaleEdge = (1.0 - scales.x) * koiScaled;
  koiScaleTone = scales.y;
  colour *= 1.0 - koiScaleEdge * (0.045 + uNetting * 0.34) * uScaleDepth;
  colour *= 1.0 - koiScaled * (0.05 - scales.y * 0.1);

  // magic: The operculum's trailing edge runs further back at the top than at the throat, so the crease is a cosine of girth rather than a straight cut.
  float gillLine = uGillStation + 0.03 * cos(body.y * KOI_TAU);
  float gillDistance = (body.x - gillLine) / 0.012;
  float flank = 1.0 - smoothstep(0.05, 0.24, abs(abs(koiGirthDelta(body.y, 0.0)) - 0.25));
  colour *= 1.0 - exp(-gillDistance * gillDistance) * flank * 0.2;

  float mouthDistance = (body.x - 0.016) / 0.01;
  colour *= 1.0 - exp(-mouthDistance * mouthDistance) * koiVentral * 0.35;

  return mix(colour, uWaterTint, uDepthFade) * uDepthDim;
}
`

/** Injected after `color_fragment` on the skin: paints the koi. */
export const SKIN_COLOUR = /* glsl */ `
diffuseColor.rgb = koiSkinColour( vBody );
`

/** Injected after `roughnessmap_fragment`: wets the skin and dulls the scale edges. */
export const SKIN_ROUGHNESS = /* glsl */ `
roughnessFactor = clamp( roughnessFactor + koiScaleEdge * 0.09 * uScaleDepth - koiScaleTone * 0.04 + koiVentral * 0.05, 0.04, 1.0 );
`

/** Injected after `metalnessmap_fragment`: lifts an ogon's ground without touching a kohaku's. */
export const SKIN_METALNESS = /* glsl */ `
metalnessFactor = clamp( metalnessFactor + uMetallicMix * ( 0.7 - koiVentral * 0.35 ), 0.0, 1.0 );
`

/** Injected after `normal_fragment_begin`: raises the scale relief. */
export const SKIN_NORMAL = /* glsl */ `
normal = koiPerturbNormal( normal, ( 1.0 - koiScaleEdge ) * uScaleDepth * 0.0016 );
`

/** Membrane uniforms and the ray field that runs through a fin. */
export const FIN_FRAGMENT_COMMON = /* glsl */ `
uniform vec3 uFinColour;
uniform vec3 uFinTipColour;
uniform float uFinRays;
uniform float uFinRayContrast;

/**
 * How far inside a fin ray a pixel sits.
 */
float koiFinRay(vec2 fin) {
  // why: Rays fan out from the root, so their spacing has to open with distance or they read as printed stripes instead of as structure.
  float spread = fract(fin.y * uFinRays);
  float ray = abs(spread - 0.5) * 2.0;
  return smoothstep(0.35, 0.95, ray) * smoothstep(0.02, 0.3, fin.x);
}
`

/** Injected after `color_fragment` on the fins: tints, ribs and fades the membrane. */
export const FIN_COLOUR = /* glsl */ `
float koiFinOut = clamp( vFin.x, 0.0, 1.0 );
vec3 koiMembrane = mix( uFinColour, uFinTipColour, koiFinOut );
// why: A koi's fins carry the body's own pattern for the first third of their length; without that bleed the fin looks glued on.
koiMembrane = mix( koiSkinColour( vBody ), koiMembrane, smoothstep( 0.0, 0.3, koiFinOut ) );
koiMembrane *= 1.0 - koiFinRay( vFin.xy ) * uFinRayContrast;
// magic: A membrane picks up a lot of light at a glancing angle; without that lift a fin seen edge-on from above reads as a dark cut in the fish.
koiMembrane *= 1.0 + 0.85 * pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.5 );
diffuseColor.rgb = mix( koiMembrane, uWaterTint, uDepthFade ) * uDepthDim;
// magic: Membrane thins toward its edge, and the rays stay solid where the web has gone; that gradient is most of what makes a fin read as tissue.
// why: The root is driven past opaque on purpose — a fin's base is flesh, and letting the backdrop through it is what makes a tail look bolted on rather than grown.
diffuseColor.a *= mix( 1.45, 0.62, smoothstep( 0.0, 0.8, koiFinOut ) ) + koiFinRay( vFin.xy ) * 0.28;
`

/** Eye uniforms and the concentric rings that make one. */
export const EYE_FRAGMENT_COMMON = /* glsl */ `
uniform vec3 uIrisColour;
uniform vec3 uPupilColour;
uniform vec3 uScleraColour;
uniform float uIrisSize;
uniform float uPupilSize;
uniform float uEyeGaze;

/**
 * How closely a point on the eyeball faces the direction the koi is looking.
 */
float koiGaze(vec4 fin) {
  return fin.x * cos(uEyeGaze) + fin.y * sin(uEyeGaze);
}
`

/** Injected after `color_fragment` on the eyes: pupil, iris ring and buried sclera. */
export const EYE_COLOUR = /* glsl */ `
float koiFacing = koiGaze( vFin );
vec3 koiEye = mix( uScleraColour, uIrisColour, smoothstep( 1.0 - uIrisSize - 0.16, 1.0 - uIrisSize, koiFacing ) );
koiEye = mix( koiEye, uPupilColour, smoothstep( 1.0 - uPupilSize - 0.05, 1.0 - uPupilSize, koiFacing ) );
// magic: A thin bright ring where the iris meets the pupil is what stops a dark eye reading as an empty socket.
koiEye += uIrisColour * 0.55 * exp( -pow( ( koiFacing - ( 1.0 - uPupilSize - 0.03 ) ) / 0.035, 2.0 ) );
diffuseColor.rgb = mix( koiEye, uWaterTint, uDepthFade * 0.6 ) * uDepthDim;
`
