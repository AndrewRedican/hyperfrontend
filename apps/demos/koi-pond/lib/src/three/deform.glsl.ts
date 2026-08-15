/**
 * The vertex program that bends the koi, shared by its skin, its fins and its eyes.
 *
 * The CPU poses a curve of thirty-two stations; this is what carries a hundred
 * thousand vertices along it. Every vertex knows which station it belongs to, so
 * bending the koi costs one interpolation and one rotation per vertex and
 * nothing at all per frame on the main thread — which is the whole reason a shoal
 * of these can eventually swim in one scene.
 *
 * Each cross-section is carried *rigidly* by its station's frame. That is what
 * preserves the koi's volume through a hard turn: the body bends, but no section
 * of it is ever squashed, sheared or inverted.
 */
import { CAUDAL_ROOT, PIVOT_STATION } from '../koi3d/config.js'
import { SPINE_SAMPLES } from '../koi3d/spine-pose.js'

/** Declarations and helpers prepended to every koi vertex program. */
export const DEFORM_VERTEX_COMMON = /* glsl */ `
#define KOI_SPINE ${SPINE_SAMPLES}
#define KOI_TAU 6.283185307179586

uniform vec4 uSpine[KOI_SPINE];
uniform vec4 uSpineAxis[KOI_SPINE];
uniform vec4 uFinFlex[7];
uniform float uKoiLength;
uniform float uBeat;

attribute vec2 aBody;
attribute vec4 aFin;

varying vec2 vBody;
varying vec4 vFin;

mat3 koiFrame;
vec3 koiCentre;
vec3 koiRestNormal;

/**
 * Reads the posed spine at a station and builds the frame it carries.
 */
void koiReadSpine(float station) {
  float scaled = clamp(station, 0.0, 1.0) * float(KOI_SPINE - 1);
  int near = int(floor(scaled));
  int far = min(near + 1, KOI_SPINE - 1);
  float blend = scaled - float(near);

  vec4 a = uSpine[near];
  vec4 b = uSpine[far];
  vec4 axisA = uSpineAxis[near];
  vec4 axisB = uSpineAxis[far];

  koiCentre = mix(a.xyz, b.xyz, blend);
  float yaw = mix(a.w, b.w, blend);
  float roll = mix(axisA.x, axisB.x, blend);
  float pitch = mix(axisA.y, axisB.y, blend);

  float cy = cos(yaw);
  float sy = sin(yaw);
  float cp = cos(pitch);
  float sp = sin(pitch);
  float cr = cos(roll);
  float sr = sin(roll);

  mat3 rollFrame = mat3(1.0, 0.0, 0.0, 0.0, cr, sr, 0.0, -sr, cr);
  mat3 pitchFrame = mat3(cp, sp, 0.0, -sp, cp, 0.0, 0.0, 0.0, 1.0);
  mat3 yawFrame = mat3(cy, 0.0, sy, 0.0, 1.0, 0.0, -sy, 0.0, cy);
  koiFrame = yawFrame * pitchFrame * rollFrame;
}

/**
 * The extra bend a membrane vertex takes on top of the body's own.
 */
vec3 koiFinFlex(vec3 restNormal) {
  int part = int(aFin.w + 0.5);
  if (part == 0 || part > 5) {
    return vec3(0.0);
  }
  vec4 flex = uFinFlex[part];
  // why: A membrane bends along its whole length, not just past halfway; the softer exponent is what makes the inner web move with the rays instead of staying rigid.
  float cantilever = pow(aFin.x, 1.45);
  float lag = flex.w * (aFin.x * 0.85 + aFin.y * 0.35);
  float phase = uBeat * flex.z + float(part) * 1.9 + aFin.z * 1.35 - lag * KOI_TAU;
  float across = abs(aFin.y * 2.0 - 1.0);
  // why: The tail's lobes have to lag its notch or the whole blade swings as one board; every other fin flexes evenly across its span.
  float fan = part == 5 ? 0.3 + 0.7 * across : 1.0;
  return vec3(-flex.x * cantilever * uKoiLength, 0.0, 0.0) + restNormal * flex.y * cantilever * fan * sin(phase) * uKoiLength;
}

/**
 * The offset of a rest vertex from the centre of its own station.
 */
vec3 koiLocalOffset(vec3 rest, float station) {
  return vec3(rest.x - (${PIVOT_STATION.toFixed(6)} - station) * uKoiLength, rest.y, rest.z);
}
`

/** Replaces `beginnormal_vertex`: poses the frame, then rotates the normal into it. */
export const DEFORM_NORMAL = /* glsl */ `
vec3 objectNormal = vec3( normal );
koiRestNormal = objectNormal;
vBody = aBody;
vFin = aFin;
koiReadSpine( aBody.x );
objectNormal = koiFrame * objectNormal;
`

/** Replaces `begin_vertex`: carries the vertex along the posed curve. */
export const DEFORM_POSITION = /* glsl */ `
vec3 koiLocal = koiLocalOffset( position, aBody.x ) + koiFinFlex( koiRestNormal );
vec3 transformed = koiCentre + koiFrame * koiLocal;
`

/** Declarations every koi fragment program needs, whatever it paints. */
export const DEFORM_FRAGMENT_COMMON = /* glsl */ `
#define KOI_TAU 6.283185307179586
#define KOI_CAUDAL_ROOT ${CAUDAL_ROOT.toFixed(6)}

varying vec2 vBody;
varying vec4 vFin;

uniform vec3 uWaterTint;
uniform float uDepthFade;
uniform float uDepthDim;

/**
 * The shortest signed distance between two positions around the body.
 */
float koiGirthDelta(float here, float there) {
  float delta = here - there;
  return delta - floor(delta + 0.5);
}

/**
 * A cheap value hash, wrapped so the body's seam never shows.
 */
float koiHash(vec2 cell) {
  vec2 wrapped = fract(cell * vec2(127.1, 311.7));
  wrapped += dot(wrapped, wrapped + 34.53);
  return fract(wrapped.x * wrapped.y * 95.4307);
}

/**
 * Value noise that repeats exactly once around the koi.
 */
float koiNoise(vec2 point, float period) {
  vec2 cell = floor(point);
  vec2 within = fract(point);
  vec2 ease = within * within * (3.0 - 2.0 * within);
  float a = koiHash(vec2(cell.x, mod(cell.y, period)));
  float b = koiHash(vec2(cell.x + 1.0, mod(cell.y, period)));
  float c = koiHash(vec2(cell.x, mod(cell.y + 1.0, period)));
  float d = koiHash(vec2(cell.x + 1.0, mod(cell.y + 1.0, period)));
  return mix(mix(a, b, ease.x), mix(c, d, ease.x), ease.y);
}
`
