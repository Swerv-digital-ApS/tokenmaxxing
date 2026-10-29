/**
 * Draws a scene the way the game would: at a low resolution, scaled up without smoothing, with a dark
 * line round every silhouette (from depth) and a light one along creases (from normals). At pixel size 1
 * it's a clean cel-shaded look instead.
 */
import * as THREE from "three";
import { blockify, unblockify } from "../kit/blocky.ts";
import { setActiveScene, setSmoothBands } from "../kit/kit.ts";
import {
  type BakeMode,
  bakePending,
  STATIC_LAYER,
  sceneEpoch,
  staticShadowEpoch,
  syncBaked,
  trackAdditions,
} from "../perf/bake.ts";
import { sortWithoutBoxing } from "../perf/boxing.ts";
import { updateDetails } from "../perf/details.ts";
import { sweep, thawAll, view, watchAll } from "../perf/freeze.ts";
import { stabilizeShadow } from "../perf/shadow-grid.ts";
import { classifyCasters } from "../perf/shadowcast.ts";
import { trackRenderer } from "../perf/stats.ts";

export type RenderStyle = "classic" | "voxel";

/**
 * Two shadow maps for one sun: a big one for what never moves, drawn once (and again when a room is re-batched or
 * the sun has moved), and a small one for what does (people, pets, walls that lower), drawn every frame or two. The
 * second is a second, intensity-0 directional light; the lit shaders multiply the two lookups for the first light.
 */
{
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  const key =
    "directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]";
  const at = chunk.indexOf(key);
  const end = at < 0 ? -1 : chunk.indexOf("\n", at);
  if (end > 0 && !chunk.includes("shadowDyn")) {
    const original = chunk.slice(at, end);
    const lookup = (n: number) =>
      `getShadow( directionalShadowMap[ ${n} ], directionalLightShadows[ ${n} ].shadowMapSize, directionalLightShadows[ ${n} ].shadowIntensity, directionalLightShadows[ ${n} ].shadowBias, directionalLightShadows[ ${n} ].shadowRadius, vDirectionalShadowCoord[ ${n} ] )`;
    // Five live texels cover about the same area as nine static texels at twice the resolution.
    const live = `dynShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowIntensity, directionalLightShadows[ 1 ].shadowBias, vDirectionalShadowCoord[ 1 ] )`;
    const patched = `#if NUM_DIR_LIGHT_SHADOWS > 1
		#if UNROLLED_LOOP_INDEX == 0
		directLight.color *= ( directLight.visible && receiveShadow ) ? ${lookup(0)} * ${live} : 1.0; // shadowDyn
		#endif
		#else
		${original}
		#endif`;
    THREE.ShaderChunk.lights_fragment_begin = chunk.slice(0, at) + patched + chunk.slice(end);
    THREE.ShaderChunk.shadowmap_pars_fragment += `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1 && defined( SHADOWMAP_TYPE_PCF )
float dynShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, vec4 shadowCoord ) {
	shadowCoord.xyz /= shadowCoord.w;
	shadowCoord.z += shadowBias;
	bool inside = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 && shadowCoord.z <= 1.0;
	return inside ? mix( 1.0, pcfTent( shadowMap, shadowMapSize, shadowCoord.xyz, 3 ), shadowIntensity ) : 1.0;
}
#endif
`;
  }
}

/**
 * Deterministic tent PCF avoids screen-space noise. Nine static texels or five live texels blend shadow edges;
 * pairing adjacent comparisons into bilinear taps needs 25 or 9 reads, respectively.
 */
{
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const head = chunk.indexOf("float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize");
  const from = chunk.indexOf("float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;", head);
  const to = from < 0 ? -1 : chunk.indexOf("* 0.2;", from);
  if (head >= 0 && to > 0) {
    const tents = /* glsl */ `
		vec2 tentPair( float offset, float phase, float width ) {
			float a = max( 0.0, width - abs( offset - phase ) );
			float b = max( 0.0, width - abs( offset + 1.0 - phase ) );
			return vec2( offset + b / ( a + b ), a + b );
		}
		float pcfTent( sampler2DShadow map, vec2 size, vec3 c, int pairs ) {
			vec2 uv = c.xy * size - 0.5;
			vec2 base = floor( uv );
			vec2 s = uv - base;
			float width = float( pairs );
			vec2 b = ( base + 0.5 ) / size;
			float sum = 0.0;
			for ( int y = 0; y < 5; y++ ) {
				if ( y >= pairs ) break;
				vec2 ty = tentPair( 2.0 * float( y ) - width + 1.0, s.y, width );
				for ( int x = 0; x < 5; x++ ) {
					if ( x >= pairs ) break;
					vec2 tx = tentPair( 2.0 * float( x ) - width + 1.0, s.x, width );
					sum += tx.y * ty.y * texture( map, vec3( b + vec2( tx.x, ty.x ) / size, c.z ) );
				}
			}
			return sum / ( width * width * width * width );
		}
		`;
    THREE.ShaderChunk.shadowmap_pars_fragment = `${chunk.slice(0, head)}${tents}${chunk.slice(head, from)}shadow = pcfTent( shadowMap, shadowMapSize, shadowCoord.xyz, 5 );${chunk.slice(to + "* 0.2;".length)}`;
  }
}

/**
 * Three draws a see-through double-sided material in two passes, flipping `side` and `needsUpdate` each time: a program
 * lookup per object per frame (several MB of garbage a second in the town's clouds and light cones). One pass looks the
 * same for the soft, mostly flat things the game makes see-through.
 */
Object.defineProperty(THREE.Material.prototype, "forceSinglePass", {
  get: () => true,
  set: () => {},
  configurable: true,
});

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
#ifdef CREASE
uniform sampler2D tNormal;
#endif
uniform vec2 texel;
uniform float span;
uniform float outline;
uniform float crease;
varying vec2 vUv;

float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * span; }
#ifdef CREASE
vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
#endif

void main() {
  vec3 color = texture2D(tColor, vUv).rgb;
  float d = depthAt(vUv);
#ifdef CREASE
  vec3 n = normalAt(vUv);
#endif
  vec2 dirs[4];
  dirs[0] = vec2(texel.x, 0.0);
  dirs[1] = vec2(-texel.x, 0.0);
  dirs[2] = vec2(0.0, texel.y);
  dirs[3] = vec2(0.0, -texel.y);
  float silhouette = 0.0;
  float edge = 0.0;
  for (int i = 0; i < 4; i++) {
    float nd = depthAt(vUv + dirs[i]);
    // Only the nearer side of a gap draws the line, so it's one pixel thick.
    silhouette = max(silhouette, step(0.12, nd - d));
#ifdef CREASE
    // Creases: a turn in the surface, drawn on the side that faces up or left.
    vec3 nn = normalAt(vUv + dirs[i]);
    float bias = step(0.0, dot(n - nn, vec3(-1.0, 1.0, 0.0)));
    edge = max(edge, step(0.35, 1.0 - dot(n, nn)) * bias * step(abs(nd - d), 0.12));
#endif
  }
  if (d > span * 0.999) silhouette = 0.0;
#ifdef CREASE
  color = mix(color, color * 1.28 + 0.03, edge * crease * (1.0 - silhouette));
#endif
  color = mix(color, color * 0.32, silhouette * outline);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** Depth reads shared by the AO pass and its blur, both drawn at a fraction of the frame's size. */
const AO_COMMON = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float span;
varying vec2 vUv;

float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * span; }
// The full-size pixel this (smaller) pixel stands for: its centre sits on a corner, where a depth read is a coin toss.
vec2 snap(vec2 uv) { return (floor(uv / texel) + 0.5) * texel; }
// Depth change per full-size pixel along this pixel's surface, from the smaller one-sided step (so not across an edge).
vec2 slope(vec2 uv, float d) {
  float dl = depthAt(uv - vec2(texel.x, 0.0));
  float dr = depthAt(uv + vec2(texel.x, 0.0));
  float du = depthAt(uv + vec2(0.0, texel.y));
  float dd = depthAt(uv - vec2(0.0, texel.y));
  float sx = abs(dr - d) < abs(d - dl) ? dr - d : d - dl;
  float sy = abs(du - d) < abs(d - dd) ? du - d : d - dd;
  return clamp(vec2(sx, sy), -2.0, 2.0);
}
`;

const VOXEL_FRAGMENT = /* glsl */ `
${AO_COMMON}
uniform sampler2D tColor;
uniform float pxPerUnit;
uniform sampler2D tAo;
uniform vec2 aoSize;
uniform float aoOn;
uniform float tilt;
uniform float haze;
uniform vec3 hazeColor;
uniform vec3 skyTop;
uniform vec3 skyHor;
uniform float gradient;
uniform float exposure;
uniform float night;
uniform float grade;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float d = depthAt(vUv);
  bool bg = d > span * 0.999;
  vec2 px = 1.0 / texel;
  // Tilt-shift: blur grows toward the top and bottom of the frame.
  float off = max(0.0, abs(vUv.y - 0.5) - 0.28) * 2.0;
  float br = tilt * off * off * 5.0;
  vec3 color = texture2D(tColor, vUv).rgb;
  if (br > 0.15) {
    vec3 acc = color;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      acc += texture2D(tColor, vUv + vec2(cos(a), sin(a)) * texel * br).rgb;
    }
    color = acc / 9.0;
  }
  if (bg) {
    if (gradient > 0.5) color = mix(skyHor, skyTop, smoothstep(0.1, 1.0, vUv.y));
  } else {
    // Ambient occlusion comes from its own (smaller) pass: a depth-aware blend of the four nearest samples.
    float ao = 1.0;
    if (aoOn > 0.5) {
      vec2 p = vUv * aoSize - 0.5;
      vec2 i0 = floor(p);
      vec2 f = p - i0;
      vec2 centerUv = snap(vUv);
      float centerDepth = depthAt(centerUv);
      vec2 surfaceSlope = slope(centerUv, centerDepth);
      float acc = 0.0;
      float wsum = 0.0;
      for (int j = 0; j < 4; j++) {
        vec2 o = vec2(float(j & 1), float(j >> 1));
        vec2 uvc = (i0 + o + 0.5) / aoSize;
        float w = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);
        vec2 sampleUv = snap(uvc);
        float dz = depthAt(sampleUv) - centerDepth - dot(surfaceSlope, (sampleUv - centerUv) / texel);
        w *= 1.0 / (0.03 + dz * dz * 40.0) + 1e-4;
        acc += texture2D(tAo, uvc).r * w;
        wsum += w;
      }
      ao = acc / wsum;
    }
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    ao = mix(ao, 1.0, smoothstep(0.8, 1.2, lum) * 0.6);
    color *= ao * mix(vec3(1.0), vec3(0.95, 1.0, 1.08), 1.0 - ao);
    // Atmospheric depth haze toward the sky colour.
    float hz = haze * smoothstep(span * 0.30, span * 0.95, d);
    color = mix(color, hazeColor, hz);
  }
  // Grade: exposure, filmic curve, a touch of saturation, warm lights and cool shadows.
  color *= exposure;
  if (grade > 0.5) {
    color = aces(color);
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(l), color, 1.14);
    color *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.94), smoothstep(0.15, 0.75, l));
    vec2 q = vUv - 0.5;
    color *= 1.0 - dot(q, q) * 0.45;
  } else {
    color = clamp(color, 0.0, 1.0);
  }
  gl_FragColor = vec4(max(color, 0.0), 1.0);
  #include <colorspace_fragment>
  // Half a display step of dither against banding, after the sRGB curve: before it, the curve's steep dark end
  // stretched the same noise into a visible grain in every shadow.
  if (grade > 0.5) gl_FragColor.rgb += (ign(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
}
`;

/** A fixed sampling kernel avoids screen-anchored noise crawling over surfaces as the camera moves. */
const AO_FRAGMENT = /* glsl */ `
${AO_COMMON}
uniform float pxPerUnit;
uniform int aoSamples;
uniform float aoRadius;
uniform float aoStrength;

void main() {
  vec2 uv = snap(vUv);
  float d = depthAt(uv);
  if (d > span * 0.999) { gl_FragColor = vec4(1.0); return; }
  vec2 s = slope(uv, d);
  vec3 normal = normalize(vec3(s * pxPerUnit, 1.0));
  // Capped in pixels: zoomed in, a unit is over a hundred of them, and the few taps a pixel takes leave clouds.
  float R = min(aoRadius * pxPerUnit, 48.0);
  float occ = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= aoSamples) break;
    float f = (float(i) + 0.5) / float(aoSamples);
    float a = (float(i) + 0.5) * 2.399963;
    // Rounded to the pixel the depth read lands in: a steep plane's half-pixel error would read as occlusion.
    vec2 o = floor(vec2(cos(a), sin(a)) * R * sqrt(f) + 0.5);
    float ds = depthAt(uv + o * texel);
    // Measure proximity in view space: raised furniture must not leave an AO copy on distant floor pixels.
    vec3 delta = vec3(o / pxPerUnit, d - ds);
    float distance = max(length(delta), 0.0001);
    float facing = max(dot(normal, delta) / distance - 0.1, 0.0);
    float nearby = 1.0 - smoothstep(aoRadius * 0.15, aoRadius, distance);
    occ += facing * nearby;
  }
  occ /= float(aoSamples);
  gl_FragColor = vec4(vec3(1.0 - clamp(occ * aoStrength, 0.0, 0.85)), 1.0);
}
`;

/**
 * Separable bilateral filtering smooths contact shading along surfaces without crossing silhouettes.
 */
const AO_BLUR = /* glsl */ `
${AO_COMMON}
uniform sampler2D tAo;
uniform vec2 blurStep;

void main() {
  vec2 uv = snap(vUv);
  float d = depthAt(uv);
  if (d > span * 0.999) { gl_FragColor = vec4(1.0); return; }
  vec2 s = slope(uv, d);
  float acc = 0.0;
  float wsum = 0.0;
  for (int j = -3; j <= 3; j++) {
    float offset = float(j);
    vec2 at = vUv + offset * blurStep;
    vec2 su = snap(at);
    float dz = depthAt(su) - d - dot(s, (su - uv) / texel);
    float spatial = exp(-offset * offset / 4.5);
    float w = spatial / (0.02 + dz * dz * 40.0);
    acc += texture2D(tAo, at).r * w;
    wsum += w;
  }
  gl_FragColor = vec4(vec3(acc / wsum), 1.0);
}
`;

const BLIT = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0);
  #include <colorspace_fragment>
}
`;

/** What the pipeline draws with. `Pipeline.configure` takes any part of it; `tiers.ts` derives it from the graphics settings. */
export interface PipelineOptions {
  style: RenderStyle;
  /** Classic styles: one rendered pixel is this many screen pixels. */
  pixelSize: number;
  /** Classic: dark silhouette lines (from depth) and light crease lines (from normals, costs a second scene pass). */
  outline: number;
  crease: number;
  /** Voxel: render resolution is `min(devicePixelRatio, dprCap) * renderScale`. */
  renderScale: number;
  dprCap: number;
  /** Shadow map edge in pixels, 0 for none. */
  shadowSize: number;
  /** How many people and pets nearest the middle of the picture are animated in full; the rest are drawn frozen (`freeze.ts`). */
  crowd: number;
  /** Soft dark discs under people and pets (one draw call): the shadow of the tiers that have no shadow map. */
  blob: boolean;
  /** The shadow map is redrawn every this many frames (static rooms barely notice 2). */
  shadowEvery: number;
  /** Ambient occlusion taps, 0 to 24. */
  aoSamples: number;
  /** The AO pass draws at this fraction of the frame's size (1, 0.5, 0.25); the composite blends it back up depth-aware. */
  aoScale: number;
  /** MSAA samples for the voxel target (0 off). */
  msaa: number;
  tilt: boolean;
  haze: boolean;
  grade: boolean;
}

const HEMI_SKY = new THREE.Color("#b9d6ff");
const HEMI_GROUND = new THREE.Color("#b89a78");
const SUN_WARM = new THREE.Color("#ffd9a8");

interface LightRef {
  l: THREE.Light;
  hemi: boolean;
  color: THREE.Color;
  ground: THREE.Color;
  intensity: number;
}
const BLOBS = 96;
const blobMatrix = new THREE.Matrix4();
interface BlobSet {
  mesh: THREE.InstancedMesh;
  actors: THREE.Object3D[];
  epoch: number;
  at: number;
}

/** A flat disc with a soft edge, lying on the floor. */
function blobMesh(): THREE.InstancedMesh {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const map = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, BLOBS);
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.noBake = true;
  mesh.userData.live = true;
  mesh.renderOrder = 1;
  mesh.count = 0;
  return mesh;
}

interface SplitShadow {
  dyn: THREE.DirectionalLight;
  /** What the baked map was drawn for: the batches' epoch, the sun's place, its size. */
  epoch: number;
  key: string;
  size: number;
  nextLive: number;
  at: number;
}
interface SceneLights {
  epoch: number;
  refs: LightRef[];
  sun?: THREE.DirectionalLight;
}

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer;
  pixelSize = 3;
  outline = 1;
  crease = 1;
  private color?: THREE.WebGLRenderTarget;
  private normal?: THREE.WebGLRenderTarget;
  private readonly normals = new THREE.MeshNormalMaterial();
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly quadCreased: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly blit: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly quadCamera = new THREE.Camera();
  private size = "";

  // ——— Voxel (Plethora) style ———
  style: RenderStyle = "classic";
  /** 0 = cheap, 1 = balanced, 2 = full (AO, tilt-shift, MSAA, 4k shadows). Drops by itself when frames run slow. */
  quality = 2;
  autoQuality = true;
  /** Colours for the composite: haze toward the sky, and a gradient sky for scenes that have none. */
  hazeColor = new THREE.Color("#cfe8f8");
  skyTop = new THREE.Color("#7fc4e8");
  skyHor = new THREE.Color("#d6efee");
  gradient = false;
  night = 0;
  /** Set by `configure`; until then everything follows `quality`, as before. */
  private opts: Partial<PipelineOptions> = {};
  private vox?: THREE.WebGLRenderTarget;
  private voxKey = "";
  private readonly voxQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly aoQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private ao?: THREE.WebGLRenderTarget;
  private readonly aoBlurQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private aoRaw?: THREE.WebGLRenderTarget;
  private aoKey = "";
  private readonly fill = new THREE.DirectionalLight("#9ec4ff", 0);
  private fillScene: THREE.Scene | null = null;
  private readonly lights = new WeakMap<THREE.Scene, SceneLights>();
  private slow = 0;
  private frames = 0;
  private mode: BakeMode | null = null;
  private lastAt = 0;
  private lastScene: THREE.Scene | null = null;
  private readonly untrack: () => void;
  private frameNo = 0;
  private sized = "";
  private shadowsWere: boolean | null = null;
  /** Per-frame facts for the console and the perf harness. */
  readonly last = { passes: 0, shadowUpdated: false, staticBakes: 0 };

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: opts.preserve ?? false,
      powerPreference: "high-performance",
    });
    sortWithoutBoxing(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The shadow map is redrawn on the pipeline's schedule (`shadowEvery`), not on every render() call.
    this.renderer.shadowMap.autoUpdate = false;
    this.staticCam.layers.set(STATIC_LAYER);
    this.liveCam.layers.set(0);
    // The shadow step runs inside `render`; split shadows draw the baked and the live map with their own layers.
    const shadowMap = this.renderer.shadowMap;
    const stock = shadowMap.render.bind(shadowMap);
    shadowMap.render = (lights, scene, camera) => {
      const plan = this.plan;
      if (!plan) return stock(lights, scene, camera);
      if (plan.fixed) {
        plan.sun.shadow.needsUpdate = true;
        stock([plan.sun], scene, this.staticCam);
      }
      if (plan.live) {
        plan.dyn.shadow.needsUpdate = true;
        shadowMap.needsUpdate = true;
        stock([plan.dyn], scene, this.liveCam);
      }
      this.plan = null;
    };
    trackAdditions();
    this.untrack = trackRenderer(this.renderer, () => this.lastScene);
    const plane = new THREE.PlaneGeometry(2, 2);
    this.voxQuad = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: VOXEL_FRAGMENT,
        uniforms: {
          tColor: { value: null },
          tDepth: { value: null },
          texel: { value: new THREE.Vector2() },
          span: { value: 1 },
          pxPerUnit: { value: 40 },
          tAo: { value: null },
          aoSize: { value: new THREE.Vector2(1, 1) },
          aoOn: { value: 0 },
          tilt: { value: 1 },
          haze: { value: 0.3 },
          hazeColor: { value: this.hazeColor },
          skyTop: { value: this.skyTop },
          skyHor: { value: this.skyHor },
          gradient: { value: 0 },
          exposure: { value: 1 },
          night: { value: 0 },
          grade: { value: 1 },
        },
      }),
    );
    this.aoQuad = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: AO_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tDepth: { value: null },
          texel: { value: new THREE.Vector2() },
          span: { value: 1 },
          pxPerUnit: { value: 40 },
          aoSamples: { value: 12 },
          aoRadius: { value: 0.35 },
          aoStrength: { value: 1.3 },
        },
      }),
    );
    this.aoBlurQuad = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: AO_BLUR,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tDepth: { value: null },
          tAo: { value: null },
          texel: { value: new THREE.Vector2() },
          blurStep: { value: new THREE.Vector2() },
          span: { value: 1 },
        },
      }),
    );
    const classic = (creased: boolean) =>
      new THREE.Mesh(
        plane,
        new THREE.ShaderMaterial({
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          defines: creased ? { CREASE: "" } : {},
          uniforms: {
            tColor: { value: null },
            tDepth: { value: null },
            tNormal: { value: null },
            texel: { value: new THREE.Vector2() },
            span: { value: 1 },
            outline: { value: 1 },
            crease: { value: 1 },
          },
          transparent: true,
        }),
      );
    this.quad = classic(false);
    this.quadCreased = classic(true);
    this.blit = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: BLIT,
        uniforms: { tColor: { value: null } },
      }),
    );
  }

  /** Applies explicit settings (see `PipelineOptions`); unset fields keep following `quality`. */
  configure(o: Partial<PipelineOptions>): void {
    Object.assign(this.opts, o);
    if (o.style) this.style = o.style;
    if (o.pixelSize !== undefined) this.pixelSize = o.pixelSize;
    if (o.outline !== undefined) this.outline = o.outline;
    if (o.crease !== undefined) this.crease = o.crease;
    this.autoQuality = false;
  }

  /** What a voxel frame is drawn with right now: the explicit options, or what `quality` implies. */
  private voxelOptions(): PipelineOptions {
    const q = this.quality;
    const o = this.opts;
    return {
      style: "voxel",
      pixelSize: 1,
      outline: 0,
      crease: 0,
      renderScale: o.renderScale ?? (q === 0 ? 0.75 : 1),
      dprCap: o.dprCap ?? (q >= 2 ? 1.5 : 1),
      shadowSize: o.shadowSize ?? (q >= 2 ? 4096 : 2048),
      blob: o.blob ?? false,
      crowd: o.crowd ?? 16,
      shadowEvery: o.shadowEvery ?? 1,
      aoSamples: o.aoSamples ?? (q >= 2 ? 16 : q === 1 ? 10 : 0),
      aoScale: o.aoScale ?? (q >= 2 ? 0.5 : 0.25),
      msaa: o.msaa ?? (q >= 2 ? 4 : 0),
      tilt: o.tilt ?? q >= 2,
      haze: o.haze ?? true,
      grade: o.grade ?? true,
    };
  }

  /** Low-resolution targets for a canvas of `w`×`h` CSS pixels. */
  private targets(w: number, h: number, depth: boolean, creased: boolean): void {
    const dpr = this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, this.opts.dprCap ?? 2) : 1;
    const scale = this.pixelSize === 1 ? (this.opts.renderScale ?? 1) : 1;
    const lw = Math.max(1, Math.floor((w * dpr * scale) / this.pixelSize));
    const lh = Math.max(1, Math.floor((h * dpr * scale) / this.pixelSize));
    const key = `${lw}x${lh}${depth ? "d" : ""}${creased ? "n" : ""}`;
    if (key === this.size) return;
    this.size = key;
    this.color?.dispose();
    this.normal?.dispose();
    this.normal = undefined;
    const filter = this.pixelSize === 1 ? THREE.LinearFilter : THREE.NearestFilter;
    // Only the outline pass reads depth; the plain blit gets by with a depth buffer and an 8-bit colour target.
    this.color = new THREE.WebGLRenderTarget(lw, lh, {
      type: depth ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: filter,
      magFilter: filter,
      depthTexture: depth ? new THREE.DepthTexture(lw, lh, THREE.FloatType) : undefined,
    });
    if (creased)
      this.normal = new THREE.WebGLRenderTarget(lw, lh, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
    for (const q of [this.quad, this.quadCreased]) {
      const u = q.material.uniforms;
      u.tColor!.value = this.color.texture;
      u.tDepth!.value = this.color.depthTexture;
      u.tNormal!.value = this.normal?.texture ?? null;
      u.texel!.value.set(1 / lw, 1 / lh);
    }
    this.blit.material.uniforms.tColor!.value = this.color.texture;
  }

  private setSize(w: number, h: number, dpr: number): void {
    const key = `${w}x${h}@${dpr}`;
    if (key === this.sized) return;
    this.sized = key;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
  }

  /** The lights of a scene, found once and again only after something was added. */
  private lightsOf(scene: THREE.Scene): SceneLights {
    let s = this.lights.get(scene);
    if (s && s.epoch === sceneEpoch()) return s;
    s = { epoch: sceneEpoch(), refs: [] };
    scene.traverse((o) => {
      const l = o as THREE.Light;
      if (!l.isLight || this.ours(o)) return;
      s!.refs.push({
        l,
        hemi: !!(l as THREE.HemisphereLight).isHemisphereLight,
        color: new THREE.Color(),
        ground: new THREE.Color(),
        intensity: 0,
      });
      const d = l as THREE.DirectionalLight;
      if (d.isDirectionalLight && (d.castShadow || d.userData.sunShadow)) {
        d.userData.sunShadow = true;
        s!.sun = d;
      }
    });
    this.lights.set(scene, s);
    return s;
  }

  private readonly splits = new WeakMap<THREE.Scene, SplitShadow>();
  private readonly blobSets = new WeakMap<THREE.Scene, BlobSet>();

  /** Under every person and pet in view, a soft disc: the whole job is one instanced draw. */
  private blobs(scene: THREE.Scene, on: boolean): void {
    let b = this.blobSets.get(scene);
    if (!on) {
      if (b) b.mesh.visible = false;
      return;
    }
    if (!b) {
      b = { mesh: blobMesh(), actors: [], epoch: -1, at: 0 };
      scene.add(b.mesh);
      this.blobSets.set(scene, b);
    }
    b.mesh.visible = true;
    if (b.epoch !== sceneEpoch() && this.frameNo - b.at > 20) {
      b.epoch = sceneEpoch();
      b.at = this.frameNo;
      b.actors.length = 0;
      scene.traverseVisible((o) => {
        if (o.userData.actor) b!.actors.push(o);
      });
    }
    let n = 0;
    const m = b.mesh;
    for (const a of b.actors) {
      if (n >= BLOBS) break;
      if (!a.visible) continue;
      const e = a.matrixWorld.elements;
      const r = (a.userData.shadowRadius as number | undefined) ?? 0.34;
      this.ball.center.set(e[12]!, e[13]!, e[14]!);
      this.ball.radius = r * 2;
      if (!this.frustum.intersectsSphere(this.ball)) continue;
      const s = r * 2 * (a.scale.x || 1);
      blobMatrix.makeScale(s, s, s).setPosition(e[12]!, e[13]! + 0.03, e[14]!);
      m.setMatrixAt(n++, blobMatrix);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }

  /** What the next render's shadow step does (see `shadowsFor`); null leaves it to three. */
  private plan: {
    sun: THREE.DirectionalLight;
    dyn: THREE.DirectionalLight;
    fixed: boolean;
    live: boolean;
  } | null = null;
  private readonly staticCam = new THREE.Camera();
  private readonly liveCam = new THREE.Camera();

  /** A light is part of the scene's own lighting, not something the pipeline added. */
  private ours(o: THREE.Object3D): boolean {
    return o === this.fill || !!o.userData.shadowDyn;
  }

  private shadowsFor(scene: THREE.Scene, size: number, every: number): void {
    const r = this.renderer;
    const { sun } = this.lightsOf(scene);
    const on = size > 0 && !!sun;
    if (this.shadowsWere !== on) {
      // Programs bake in whether shadows are on: they recompile once when it flips.
      this.shadowsWere = on;
      r.shadowMap.enabled = size > 0;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
      });
    }
    if (sun) {
      sun.castShadow = size > 0;
      const sh = sun.shadow;
      if (size > 0 && sh.mapSize.x !== size) {
        sh.mapSize.set(size, size);
        sh.map?.dispose();
        sh.map = null;
        const st = this.splits.get(scene);
        if (st) st.size = 0;
      }
      if (on) stabilizeShadow(sun);
    }
    this.last.shadowUpdated = false;
    // Once a room is batched its shadow splits in two (and stays split, so the shaders don't change back and forth).
    let st = this.splits.get(scene);
    // The split's light goes in as soon as the room is batched (`prepare`), dark and never drawn into until the
    // split starts: shaders count lights, so the ones compiled ahead of the room's first frame stay the ones it uses.
    if (!st && on && sun && scene.userData.splitReady && !scene.userData.splitLight) {
      const dyn = new THREE.DirectionalLight(0xffffff, 0);
      dyn.userData.shadowDyn = true;
      dyn.castShadow = true;
      dyn.shadow.autoUpdate = false;
      scene.add(dyn, dyn.target);
      scene.userData.splitLight = dyn;
    }
    // Its map has to exist before anything samples it (an empty shadow sampler fails every draw): drawn once, empty.
    const split = scene.userData.splitLight as THREE.DirectionalLight | undefined;
    const unmapped = !st && !!split?.castShadow && !split.shadow.map;
    if (unmapped) split.shadow.needsUpdate = true;
    if (!st && on && sun && !bakePending(scene) && (this.frameNo > 30 || scene.userData.splitReady)) {
      const dyn = split ?? new THREE.DirectionalLight(0xffffff, 0);
      dyn.userData.shadowDyn = true;
      dyn.castShadow = true;
      dyn.shadow.autoUpdate = false;
      if (dyn.parent !== scene) scene.add(dyn, dyn.target);
      st = { dyn, epoch: -1, key: "", size: 0, nextLive: 0, at: 0 };
      this.splits.set(scene, st);
    }
    if (!st || !sun) {
      r.shadowMap.needsUpdate =
        on && (unmapped || this.frameNo % Math.max(1, every) === 0 || !sun?.shadow.map);
      this.last.shadowUpdated = r.shadowMap.needsUpdate;
      return;
    }
    const dyn = st.dyn;
    dyn.visible = dyn.castShadow = on;
    this.plan = null;
    if (!on) {
      r.shadowMap.needsUpdate = false;
      return;
    }
    // The small map follows the sun exactly.
    const sc = sun.shadow.camera;
    const key = [
      Math.round(sun.position.x / 0.2),
      Math.round(sun.position.y / 0.2),
      Math.round(sun.position.z / 0.2),
      Math.round(sun.target.position.x / 0.2),
      Math.round(sun.target.position.y / 0.2),
      Math.round(sun.target.position.z / 0.2),
      sc.left,
      sc.right,
      sc.top,
      sc.bottom,
      sc.near,
      sc.far,
      sc.zoom,
      sun.shadow.bias,
      sun.shadow.normalBias,
    ].join(",");
    dyn.position.copy(sun.position);
    dyn.target.position.copy(sun.target.position);
    dyn.shadow.bias = sun.shadow.bias;
    dyn.shadow.normalBias = sun.shadow.normalBias;
    dyn.shadow.radius = sun.shadow.radius;
    const liveSize = Math.max(512, Math.min(2048, size / 2));
    if (dyn.shadow.mapSize.x !== liveSize) {
      dyn.shadow.mapSize.set(liveSize, liveSize);
      dyn.shadow.map?.dispose();
      dyn.shadow.map = null;
    }
    const dc = dyn.shadow.camera;
    if (
      dc.left !== sc.left ||
      dc.right !== sc.right ||
      dc.top !== sc.top ||
      dc.bottom !== sc.bottom ||
      dc.near !== sc.near ||
      dc.far !== sc.far ||
      dc.zoom !== sc.zoom
    ) {
      dc.left = sc.left;
      dc.right = sc.right;
      dc.top = sc.top;
      dc.bottom = sc.bottom;
      dc.near = sc.near;
      dc.far = sc.far;
      dc.zoom = sc.zoom;
      dc.updateProjectionMatrix();
    }
    stabilizeShadow(dyn);
    sun.shadow.autoUpdate = false;
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    dyn.updateMatrixWorld();
    dyn.target.updateMatrixWorld();
    classifyCasters(scene);
    const now = performance.now();
    const invalid = st.epoch !== staticShadowEpoch() || st.size !== size || !sun.shadow.map;
    const plan = { sun, dyn, fixed: false, live: false };
    if (invalid || (st.key !== key && now - st.at > 120)) {
      st.epoch = staticShadowEpoch();
      st.key = key;
      st.size = size;
      st.at = now;
      plan.fixed = true;
      this.last.staticBakes++;
    }
    if (plan.fixed || this.frameNo >= st.nextLive || !dyn.shadow.map) {
      st.nextLive = this.frameNo + Math.max(1, every);
      plan.live = true;
    }
    this.plan = plan.fixed || plan.live ? plan : null;
    r.shadowMap.needsUpdate = !!this.plan;
    this.last.shadowUpdated = !!this.plan;
  }

  /** Soft lit matte look: smooth diffuse, retuned lights, big soft shadows, then AO/haze/grade in one pass. */
  private renderVoxel(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
    const o = this.voxelOptions();
    const dpr = Math.min(window.devicePixelRatio || 1, o.dprCap) * o.renderScale;
    this.setSize(w, h, dpr);
    const lw = Math.max(1, Math.floor(w * dpr));
    const lh = Math.max(1, Math.floor(h * dpr));
    const key = `${lw}x${lh}x${o.msaa}`;
    if (key !== this.voxKey) {
      this.voxKey = key;
      this.vox?.dispose();
      this.vox = new THREE.WebGLRenderTarget(lw, lh, {
        type: THREE.HalfFloatType,
        samples: o.msaa,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthTexture: new THREE.DepthTexture(lw, lh, THREE.FloatType),
      });
      const u = this.voxQuad.material.uniforms;
      u.tColor!.value = this.vox.texture;
      u.tDepth!.value = this.vox.depthTexture;
      u.texel!.value.set(1 / lw, 1 / lh);
    }
    const aoW = Math.max(1, Math.round(lw * o.aoScale));
    const aoH = Math.max(1, Math.round(lh * o.aoScale));
    const aoKey = o.aoSamples > 0 ? `${aoW}x${aoH}` : "";
    if (aoKey !== this.aoKey) {
      this.aoKey = aoKey;
      this.ao?.dispose();
      this.aoRaw?.dispose();
      this.ao = this.aoRaw = undefined;
      if (aoKey) {
        const target = () =>
          new THREE.WebGLRenderTarget(aoW, aoH, {
            type: THREE.UnsignedByteType,
            depthBuffer: false,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
          });
        this.aoRaw = target();
        this.ao = target();
        this.voxQuad.material.uniforms.aoSize!.value.set(aoW, aoH);
      }
      this.voxQuad.material.uniforms.tAo!.value = this.aoRaw?.texture ?? null;
    }
    // Lights: cool sky over warm bounce, a warm sun with big soft shadows, a cool fill from the far side.
    const { refs, sun } = this.lightsOf(scene);
    for (const e of refs) {
      const l = e.l;
      e.color.copy(l.color);
      e.intensity = l.intensity;
      if (e.hemi) {
        const hemi = l as THREE.HemisphereLight;
        e.ground.copy(hemi.groundColor);
        hemi.color.lerp(HEMI_SKY, 0.4);
        hemi.groundColor.lerp(HEMI_GROUND, 0.5);
        hemi.intensity = e.intensity * 0.6;
      } else if (l === sun) {
        l.color.lerp(SUN_WARM, 0.35);
        l.intensity = e.intensity * 1.4;
      }
    }
    this.blobs(scene, o.blob);
    if (sun) {
      const sh = sun.shadow;
      sun.userData.classic ??= { size: sh.mapSize.x, radius: sh.radius, bias: sh.bias };
      sh.radius = o.shadowSize >= 2048 ? 4 : 2;
      sh.bias = -0.0006;
      if (this.fill.parent !== scene) {
        this.restoreFillScene();
        scene.add(this.fill, this.fill.target);
        this.fillScene = scene;
        const off = scene.userData.onDispose as (() => void) | undefined;
        if (!scene.userData.fillCleanup) {
          scene.userData.fillCleanup = true;
          scene.userData.onDispose = () => {
            off?.();
            if (this.fillScene === scene) this.restoreFillScene();
            if (this.lastScene === scene) {
              this.lastScene = null;
              setActiveScene(null);
            }
          };
        }
      }
      const t = sun.target.position;
      this.fill.target.position.copy(t);
      this.fill.position.set(2 * t.x - sun.position.x, 6, 2 * t.z - sun.position.z);
      this.fill.intensity = Math.min(1.2, sun.intensity * 0.22);
    }
    this.shadowsFor(scene, o.shadowSize, o.shadowEvery);

    r.setRenderTarget(this.vox!);
    r.render(scene, camera);

    for (const e of refs) {
      e.l.color.copy(e.color);
      e.l.intensity = e.intensity;
      if (e.hemi) (e.l as THREE.HemisphereLight).groundColor.copy(e.ground);
    }

    const span = camera.far - camera.near;
    if (this.ao) {
      const a = this.aoQuad.material.uniforms;
      a.tDepth!.value = this.vox!.depthTexture;
      a.texel!.value.set(1 / lw, 1 / lh);
      a.span!.value = span;
      a.pxPerUnit!.value = lw / ((camera.right - camera.left) / camera.zoom);
      a.aoSamples!.value = o.aoSamples;
      a.aoStrength!.value = this.night > 0.5 ? 1.0 : 1.3;
      r.setRenderTarget(this.aoRaw!);
      r.render(this.aoQuad, this.quadCamera);
      const b = this.aoBlurQuad.material.uniforms;
      b.tDepth!.value = this.vox!.depthTexture;
      b.texel!.value.set(1 / lw, 1 / lh);
      b.span!.value = span;
      b.tAo!.value = this.aoRaw!.texture;
      b.blurStep!.value.set(1 / aoW, 0);
      r.setRenderTarget(this.ao);
      r.render(this.aoBlurQuad, this.quadCamera);
      b.tAo!.value = this.ao.texture;
      b.blurStep!.value.set(0, 1 / aoH);
      r.setRenderTarget(this.aoRaw!);
      r.render(this.aoBlurQuad, this.quadCamera);
    }
    const u = this.voxQuad.material.uniforms;
    u.span!.value = span;
    u.aoOn!.value = this.ao ? 1 : 0;
    u.tilt!.value = o.tilt ? 1 : 0;
    u.haze!.value = scene.userData.noHaze || !o.haze ? 0 : 0.3;
    u.gradient!.value = this.gradient ? 1 : 0;
    u.exposure!.value = this.night > 0.5 ? 1.5 : 1.05;
    u.grade!.value = o.grade ? 1 : 0;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.voxQuad, this.quadCamera);
    this.last.passes = this.ao ? 5 : 2;
    this.watch();
  }

  /** Frees the render targets, the composite passes and the renderer itself. */
  dispose(): void {
    this.untrack();
    this.lastScene = null;
    setActiveScene(null);
    this.restoreFillScene();
    this.color?.dispose();
    this.normal?.dispose();
    this.vox?.dispose();
    this.ao?.dispose();
    this.aoRaw?.dispose();
    this.color = this.normal = this.vox = this.ao = this.aoRaw = undefined;
    this.aoKey = "";
    for (const quad of [this.quad, this.quadCreased, this.blit, this.voxQuad, this.aoQuad, this.aoBlurQuad]) {
      quad.geometry.dispose();
      quad.material.dispose();
    }
    this.normals.dispose();
    this.fill.shadow.map?.dispose();
    this.renderer.dispose();
  }

  /** If frames keep taking too long, step down a quality level. */
  private watch(): void {
    const now = performance.now();
    const dt = now - this.lastAt;
    this.lastAt = now;
    if (!this.autoQuality || dt > 250) return; // hidden tab or a hitch
    this.frames++;
    if (dt > 30) this.slow++;
    if (this.frames >= 90) {
      if (this.slow > 55 && this.quality > 0) this.quality--;
      this.frames = this.slow = 0;
    }
  }

  /** Back to the classic styles: drop the fill light from every scene it joined. */
  private leaveVoxel(): void {
    this.restoreFillScene();
    this.voxKey = "";
    this.vox?.dispose();
    this.vox = undefined;
  }

  private restoreFillScene(): void {
    const scene = this.fillScene;
    if (!scene) return;
    scene.remove(this.fill, this.fill.target);
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      const c = l.userData.classic as { size: number; radius: number; bias: number } | undefined;
      if (!l.isDirectionalLight || !c) return;
      l.shadow.mapSize.set(c.size, c.size);
      l.shadow.map?.dispose();
      l.shadow.map = null;
      l.shadow.radius = c.radius;
      l.shadow.bias = c.bias;
    });
    this.fillScene = null;
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    // World matrices once per frame: the shadow passes run before the renderer's own update would, and need them fresh.
    camera.layers.enable(STATIC_LAYER);
    this.look(scene, camera, w);
    scene.updateMatrixWorld();
    const auto = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;
    try {
      this.draw(scene, camera, w, h);
    } finally {
      scene.matrixWorldAutoUpdate = auto;
    }
  }

  private readonly crowds = new WeakMap<
    THREE.Scene,
    { epoch: number; at: number; actors: THREE.Object3D[] }
  >();
  private readonly rank: { o: THREE.Object3D; d: number }[] = [];
  private readonly ndc = new THREE.Vector3();

  /**
   * Only the people nearest the middle of the picture are animated in full: past `crowd` of them the rest are drawn
   * frozen, gliding without a stride. Marked on each one as `userData.lod` for the animation code to read.
   */
  private rankActors(scene: THREE.Scene): void {
    let c = this.crowds.get(scene);
    if (!c) {
      c = { epoch: -1, at: -99, actors: [] };
      this.crowds.set(scene, c);
    }
    if (c.epoch !== sceneEpoch() && this.frameNo - c.at > 20) {
      c.epoch = sceneEpoch();
      c.at = this.frameNo;
      c.actors.length = 0;
      scene.traverseVisible((o) => {
        if (o.userData.actor) c.actors.push(o);
      });
    }
    const budget = this.voxelOptions().crowd;
    if (c.actors.length <= budget) {
      for (const a of c.actors) a.userData.lod = 0;
      return;
    }
    this.rank.length = 0;
    for (const a of c.actors) {
      const e = a.matrixWorld.elements;
      this.ndc.set(e[12]!, e[13]!, e[14]!).project(this.cam!);
      this.rank.push({ o: a, d: this.ndc.x * this.ndc.x + this.ndc.y * this.ndc.y });
    }
    this.rank.sort((a, b) => a.d - b.d);
    this.rank.forEach((r, i) => {
      r.o.userData.lod = i < budget ? 0 : 1;
    });
  }

  private cam?: THREE.Camera;
  private readonly frustum = new THREE.Frustum();
  private readonly viewMatrix = new THREE.Matrix4();
  private readonly ball = new THREE.Sphere();

  /** Tells animation code what the camera sees (`freeze.ts`): how big things are, and what is out of the picture. */
  private look(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number): void {
    camera.updateMatrixWorld();
    this.cam = camera;
    this.frustum.setFromProjectionMatrix(
      this.viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    view.pxPerUnit = w / ((camera.right - camera.left) / camera.zoom);
    view.sees = (p, r) => {
      this.ball.center.set(p.x, p.y + r * 0.5, p.z);
      this.ball.radius = r;
      return this.frustum.intersectsSphere(this.ball);
    };
    this.rankActors(scene);
    // Frozen copies of people who left every scene are freed now and then.
    watchAll();
    if (++view.frame % 300 === 0) sweep();
  }

  /**
   * The CPU work a scene's first frame would do (batching its still parts, swapping in the blocky geometry), done
   * early on a room that is built but not yet shown, so the frame it is first shown on is only the draw.
   */
  prepare(scene: THREE.Scene): void {
    const voxel = this.style === "voxel";
    // Before the first frame of all (a room built behind the loading veil) the mode is the style's.
    this.mode ??= voxel ? "block" : "smooth";
    if (this.mode !== (voxel ? "block" : "smooth")) return;
    syncBaked(scene, this.mode);
    if (voxel) {
      blockify(scene);
      scene.userData.blockEpoch = sceneEpoch();
    }
    // Batched now, so its shadow may split at once (`shadowsFor`): the frames that compile its shaders ahead see
    // the lights it will keep, rather than every material compiling again thirty frames after it is shown.
    scene.userData.splitReady = true;
  }

  private draw(scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): void {
    const r = this.renderer;
    this.frameNo++;
    if (scene !== this.lastScene) this.frameNo = 0;
    this.lastScene = scene;
    setActiveScene(scene);
    setSmoothBands(this.style === "voxel");
    const mode: BakeMode = this.style === "voxel" ? "block" : "smooth";
    if (mode !== this.mode) {
      this.mode = mode;
      thawAll(mode);
    }
    syncBaked(scene, mode);
    updateDetails(scene, view.pxPerUnit);
    if (this.style === "voxel") {
      // Only when something was added since: swapping geometries is not free, and the scene is mostly still.
      if (!scene.userData.blocky || scene.userData.blockEpoch !== sceneEpoch()) {
        blockify(scene);
        scene.userData.blockEpoch = sceneEpoch();
      }
      scene.userData.blocky = true;
      this.renderVoxel(scene, camera, w, h);
      return;
    }
    if (scene.userData.blocky) {
      unblockify(scene);
      scene.userData.blocky = false;
      scene.userData.blockyDone = false;
    }
    if (this.fillScene) this.leaveVoxel();
    const dpr = this.pixelSize === 1 ? Math.min(window.devicePixelRatio || 1, this.opts.dprCap ?? 2) : 1;
    this.setSize(w, h, dpr);
    const lines = this.outline > 0 || this.crease > 0;
    const creased = this.crease > 0;
    this.targets(w, h, lines, creased);
    this.shadowsFor(scene, this.opts.shadowSize ?? 2048, this.opts.shadowEvery ?? 1);
    this.blobs(scene, !!this.opts.blob);
    const q = creased ? this.quadCreased : this.quad;
    const u = q.material.uniforms;
    u.span!.value = camera.far - camera.near;
    u.outline!.value = this.outline;
    u.crease!.value = this.crease;

    r.setRenderTarget(this.color!);
    r.render(scene, camera);
    this.last.passes = 2;

    if (creased) {
      // Normals of everything solid: see-through things (glass, faces, light cones) would draw lines.
      const hidden: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material.transparent) hidden.push(o);
      });
      for (const o of hidden) o.visible = false;
      const background = scene.background;
      scene.background = null;
      scene.overrideMaterial = this.normals;
      r.setRenderTarget(this.normal!);
      r.setClearColor(0x8080ff, 1);
      r.clear();
      // The shadow map from the colour pass is still good: this one only reads normals.
      r.shadowMap.needsUpdate = false;
      r.render(scene, camera);
      scene.overrideMaterial = null;
      scene.background = background;
      for (const o of hidden) o.visible = true;
      r.setClearColor(0x000000, 0);
      this.last.passes = 3;
    }

    r.setRenderTarget(null);
    r.clear();
    r.render(lines ? q : this.blit, this.quadCamera);
  }
}
