/**
 * The surface water, drawn on the GPU.
 *
 * One fullscreen triangle and one fragment shader replace the per-frame
 * gradient fills the 2D surface used to pay: the caustic web is evaluated per
 * pixel in pond space (so it holds still under a resize and drifts only with
 * time), and every live ripple arrives as a resolved ring the shader turns
 * into a lit crest with a soft inner echo. The buffer renders below device
 * resolution on purpose — water is soft, and the upscale reads as depth.
 *
 * A second, far slower field — the veil — rides over the caustics: the soft
 * sheen of the surface itself, slightly brighter and much broader, so the fish
 * visibly swim under a skin of water. It lives only here; the 2D fallback
 * stays at its minimum per-frame cost and simply goes without.
 *
 * This is the host's only WebGL context, and it is optional twice over: the
 * painter returns `null` where a context cannot be created, and the caller
 * falls back to the 2D painter next door. The koi never share it — the fish
 * contexts belong to the fish apps themselves, and that stays their budget.
 */
import type { SurfaceFrame, SurfacePainter } from './surface-canvas'
import { resolveRipple } from './ripples'

/** How many rings the shader takes per frame; the oldest beyond this simply skip a frame. */
const MAX_SHADER_RIPPLES = 12

/** The buffer's resolution as a fraction of CSS pixels; water needs far less than text does. */
const WATER_RESOLUTION = 0.72

/** The device-pixel-ratio ceiling for the water buffer. */
const WATER_MAX_DPR = 1.5

/** How much reduced motion damps the caustic drift and ring brightness. */
const REDUCED_MOTION_DAMPING = 0.35

const VERTEX_SOURCE = `
attribute vec2 aCorner;
varying vec2 vUv;
void main() {
  vUv = aCorner * 0.5 + 0.5;
  gl_Position = vec4(aCorner, 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `
precision mediump float;

uniform vec2 uSize;
uniform vec2 uView;
uniform float uTime;
uniform float uDamp;
uniform float uFish;
uniform float uFade;
uniform int uCount;
uniform vec4 uRipples[${MAX_SHADER_RIPPLES}];

varying vec2 vUv;

// how: One broad, slow-rolling field, read far softer than the caustics — the sheen of the surface itself rather than the light it refracts. Its crests drift at a fraction of the caustic pace, which is what reads as a calm skin of water over the fish.
float veil(vec2 p, float t) {
  vec2 q = p * 0.0034;
  float roll = sin(q.x * 1.9 + t * 0.055) + sin(q.y * 1.4 - t * 0.043) + sin((q.x - q.y) * 1.15 + t * 0.07);
  return smoothstep(0.35, 1.0, 0.5 + roll / 6.0);
}

// how: Two warped sine fields summed; the light lives where the sum crosses zero, which is what draws the filament web a real surface refracts onto everything under it.
float caustic(vec2 p, float t) {
  vec2 q = p;
  q.x += sin(p.y * 0.011 + t * 0.24) * 34.0;
  q.y += cos(p.x * 0.009 + t * 0.19) * 30.0;
  float folds = sin(q.x * 0.021 + t * 0.31) + sin(q.y * 0.024 - t * 0.26) + sin((q.x + q.y) * 0.013 + t * 0.42);
  return pow(max(0.0, 1.0 - abs(folds) * 0.5), 3.0);
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 pond = px + uView;
  float t = uTime * uDamp;

  float light = caustic(pond, t) * 0.62 + caustic(pond * 2.1 + 57.0, t * 1.35) * 0.38;
  float alpha = light * 0.085 * uDamp;
  // why: The veil stays a whisper — bright enough to say the fish swim under a surface, never enough to obscure them or the chrome above the water.
  float sheen = veil(pond, t) * 0.045 * uDamp;

  float crestWidth = max(1.5, uFish * 0.045);
  for (int i = 0; i < ${MAX_SHADER_RIPPLES}; i += 1) {
    if (i >= uCount) {
      break;
    }
    vec4 ring = uRipples[i];
    float d = distance(px, ring.xy);
    float crest = exp(-pow((d - ring.z) / crestWidth, 2.0));
    float echo = exp(-pow((d - ring.z * 0.62) / (crestWidth * 0.7), 2.0)) * 0.42;
    // why: A faint dip just inside the crest is what separates "water moved" from "a circle was drawn".
    float trough = exp(-pow((d - ring.z + crestWidth * 1.8) / crestWidth, 2.0)) * 0.3;
    alpha += (crest * 0.8 + echo - trough * 0.5) * ring.w * uDamp;
  }
  alpha = clamp(alpha, 0.0, 0.6);

  if (uFade > 0.0) {
    // how: A rounded-rectangle distance field; past the fade band the surface's own light thins toward half, matching the bed fading beneath it.
    vec2 half_ = uSize * 0.5;
    vec2 fromCentre = abs(px - half_);
    vec2 corner = fromCentre - (half_ - vec2(18.0));
    float outside = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0);
    float edge = clamp(1.0 + outside / 28.0, 0.0, 1.0);
    float shade = mix(1.0, 0.5 + 0.5 * (1.0 - edge), uFade);
    alpha *= shade;
    sheen *= shade;
  }

  gl_FragColor = vec4(vec3(0.588, 0.886, 0.824) * alpha + vec3(0.82, 0.95, 0.93) * sheen, alpha + sheen);
}
`

/**
 * Compiles one shader, or reports why it would not.
 *
 * @param gl - The context.
 * @param kind - Vertex or fragment.
 * @param source - The GLSL source.
 * @returns The shader, or `null` on failure.
 */
function compile(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader | null {
  const shader = gl.createShader(kind)
  if (shader === null) {
    return null
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Everything the water is drawn with that belongs to one GPU context, and dies with it. */
interface WaterScene {
  /** Where each uniform lives in the linked program. */
  locations: Record<'size' | 'view' | 'time' | 'damp' | 'fish' | 'fade' | 'count' | 'ripples', WebGLUniformLocation | null>
}

/**
 * Builds everything the water is drawn with inside one context.
 *
 * Separated from the painter because a context can be taken away and given
 * back: every shader, program, buffer and uniform location above is owned by
 * the context that made it, so a restored context needs all of them again.
 *
 * @param gl - The context to build in.
 * @returns The scene, or `null` where the GPU would not take it.
 */
function buildScene(gl: WebGLRenderingContext): WaterScene | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE)
  const program = gl.createProgram()
  if (vertex === null || fragment === null || program === null) {
    return null
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    return null
  }
  gl.useProgram(program)

  const corners = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, corners)
  // how: One triangle large enough to cover clip space beats a quad — no index buffer, no seam.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aCorner = gl.getAttribLocation(program, 'aCorner')
  gl.enableVertexAttribArray(aCorner)
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0)

  return {
    locations: {
      size: gl.getUniformLocation(program, 'uSize'),
      view: gl.getUniformLocation(program, 'uView'),
      time: gl.getUniformLocation(program, 'uTime'),
      damp: gl.getUniformLocation(program, 'uDamp'),
      fish: gl.getUniformLocation(program, 'uFish'),
      fade: gl.getUniformLocation(program, 'uFade'),
      count: gl.getUniformLocation(program, 'uCount'),
      ripples: gl.getUniformLocation(program, 'uRipples'),
    },
  }
}

/**
 * Binds a GPU painter to the surface canvas.
 *
 * The painter survives losing its context. A browser reclaiming GPU memory from
 * a backgrounded tab takes this one first, and it is never given back unless
 * the page asks for it by preventing the loss event's default. Nothing else on
 * the pond covers for it: every koi rebuilds its own context on waking, and
 * those rebuilds are themselves the likeliest reason this context went, so a
 * visitor returning to the tab would find the fish exactly as they were and the
 * water simply gone.
 *
 * @param canvas - The surface canvas, sitting above every koi layer.
 * @param onLost - Told the moment the context goes, so a caller can arrange a replacement if none is restored.
 * @returns The painter, or `null` where WebGL is unavailable — the caller falls back to the 2D painter.
 *
 * @example Preferring the GPU with a graceful fallback
 * ```typescript
 * const surface = createWaterPainter(canvas) ?? createSurfacePainter(canvas)
 * ```
 */
export function createWaterPainter(canvas: HTMLCanvasElement, onLost?: () => void): SurfacePainter | null {
  let asked: WebGLRenderingContext | null
  try {
    asked = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  } catch {
    return null
  }
  if (asked === null) {
    return null
  }

  const gl = asked
  let scene = buildScene(gl)
  if (scene === null) {
    return null
  }

  const rippleData = new Float32Array(MAX_SHADER_RIPPLES * 4)
  let sizedTo = ''

  // why: Preventing the default is the whole request — a browser only attempts to restore a context the page has said it still wants, and this listener is the difference between water that comes back and water that does not.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    scene = null
    // why: The loss arrives long after the page came back — it is the koi waking that costs the water its context, not the tab switch itself — so the owner is told when it happens rather than asked at a moment that turns out to be too early.
    onLost?.()
  })

  canvas.addEventListener('webglcontextrestored', () => {
    scene = buildScene(gl)
    // why: The new context starts at the canvas's default size with a viewport to match, so the next frame has to size it again rather than trusting what the last context was told.
    sizedTo = ''
  })

  return {
    lost: () => scene === null || gl.isContextLost(),

    paint(frame: SurfaceFrame) {
      const drawn = scene
      if (drawn === null || gl.isContextLost() || frame.width === 0 || frame.height === 0) {
        return
      }
      const { locations } = drawn
      const ratio = Math.min(frame.pixelRatio, WATER_MAX_DPR) * WATER_RESOLUTION
      const signature = `${frame.width}x${frame.height}@${ratio}`
      if (signature !== sizedTo) {
        canvas.width = Math.max(1, Math.round(frame.width * ratio))
        canvas.height = Math.max(1, Math.round(frame.height * ratio))
        canvas.style.width = `${frame.width}px`
        canvas.style.height = `${frame.height}px`
        gl.viewport(0, 0, canvas.width, canvas.height)
        sizedTo = signature
      }

      const damping = frame.reducedMotion ? REDUCED_MOTION_DAMPING : 1
      let count = 0
      for (const ripple of frame.field.ripples) {
        if (count >= MAX_SHADER_RIPPLES) {
          break
        }
        const resolved = resolveRipple(ripple, frame.fishLength)
        if (resolved.alpha <= 0.002 || resolved.radius <= 0) {
          continue
        }
        rippleData[count * 4] = resolved.origin.x - frame.view.x
        rippleData[count * 4 + 1] = resolved.origin.y - frame.view.y
        rippleData[count * 4 + 2] = resolved.radius
        rippleData[count * 4 + 3] = resolved.alpha
        count += 1
      }

      gl.uniform2f(locations.size, frame.width, frame.height)
      gl.uniform2f(locations.view, frame.view.x, frame.view.y)
      gl.uniform1f(locations.time, frame.elapsedMs / 1000)
      gl.uniform1f(locations.damp, damping)
      gl.uniform1f(locations.fish, frame.fishLength)
      gl.uniform1f(locations.fade, frame.fade)
      gl.uniform1i(locations.count, count)
      gl.uniform4fv(locations.ripples, rippleData)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}
