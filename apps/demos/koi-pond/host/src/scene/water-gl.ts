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
 * This is the host's only WebGL context, and it is optional twice over: the
 * painter returns `null` where a context cannot be created, and the caller
 * falls back to the 2D painter next door. The koi never share it — seven fish
 * contexts belong to the seven fish apps, and that stays their budget.
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
    alpha *= mix(1.0, 0.5 + 0.5 * (1.0 - edge), uFade);
  }

  gl_FragColor = vec4(vec3(0.588, 0.886, 0.824) * alpha, alpha);
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

/**
 * Binds a GPU painter to the surface canvas.
 *
 * @param canvas - The surface canvas, sitting above every koi layer.
 * @returns The painter, or `null` where WebGL is unavailable — the caller falls back to the 2D painter.
 *
 * @example Preferring the GPU with a graceful fallback
 * ```typescript
 * const surface = createWaterPainter(canvas) ?? createSurfacePainter(canvas)
 * ```
 */
export function createWaterPainter(canvas: HTMLCanvasElement): SurfacePainter | null {
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  } catch {
    return null
  }
  if (gl === null) {
    return null
  }

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

  const locations = {
    size: gl.getUniformLocation(program, 'uSize'),
    view: gl.getUniformLocation(program, 'uView'),
    time: gl.getUniformLocation(program, 'uTime'),
    damp: gl.getUniformLocation(program, 'uDamp'),
    fish: gl.getUniformLocation(program, 'uFish'),
    fade: gl.getUniformLocation(program, 'uFade'),
    count: gl.getUniformLocation(program, 'uCount'),
    ripples: gl.getUniformLocation(program, 'uRipples'),
  }

  const rippleData = new Float32Array(MAX_SHADER_RIPPLES * 4)
  let sizedTo = ''

  return {
    paint(frame: SurfaceFrame) {
      if (gl === null || gl.isContextLost() || frame.width === 0 || frame.height === 0) {
        return
      }
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
