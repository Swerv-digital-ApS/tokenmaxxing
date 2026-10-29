import * as THREE from "three";
import { addPatch } from "../kit/patches.ts";
import { occlusionRaycast } from "./occlusion-ray.ts";
import { pickable } from "./pick.ts";

/**
 * A cutaway through foreground scenery when it hides most of the player's upper body.
 * One uniform shared by every patched material:
 * x, y: the player's place in the render target's pixels; z: their depth from the camera; w: the ring's
 * radius in those pixels (0 turns it off).
 *
 * What is cut is decided per piece (a leaf block, a wall, a roof), never per pixel: by pixel, a block straddling the
 * player's depth was sliced diagonally across its faces, and the slice swept over it with every step (the trees and
 * walls glittering round the player as they walked). A batched mesh (`perf/bake.ts`) carries each source piece's middle
 * in `seeAt` (w = 2), as does any geometry `seeThrough` or the Voxel swap has seen (`markMiddle`); anything else (a
 * person, built after) uses its own origin.
 */
export const SEE = { value: new THREE.Vector4(0, 0, 0, 0) };

/** How much nearer than the player (world units) a thing must be to hide them (`PlayerOcclusion`'s probe). */
const NEARER = 0.9;
/** How much nearer than the player a piece's middle must be to be cut: its surface is about half a piece nearer. */
const PIECE_NEARER = 0.5;
/** Below this height (the floor, a lawn, a path) nothing is cut. */
const FLOOR_TOP = 0.14;
/** The hole's radius, as a share of the ring's; the rim and the shade round it take the rest. */
const HOLE = 0.78;

const patch = (sh: Parameters<THREE.Material["onBeforeCompile"]>[0]) => {
  sh.uniforms.uSee = SEE;
  sh.vertexShader = sh.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vSeeZ;\nvarying float vSeeY;\nattribute vec4 seeAt;",
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
  // Where this piece is: its middle (seeAt.w = 2: a batch's source piece, or a marked geometry), else its origin.
  vec4 seeO = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
  seeO = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  if (seeAt.w > 1.5) seeO = modelMatrix * vec4(seeAt.xyz, 1.0);
  vSeeZ = -(viewMatrix * seeO).z;
  vSeeY = (modelMatrix * vec4(transformed, 1.0)).y;`,
    );
  sh.fragmentShader = sh.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vSeeZ;\nvarying float vSeeY;\nuniform vec4 uSee;",
    )
    .replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
  float seeRim = 0.0;
  float seeShade = 0.0;
  if (uSee.w > 0.0 && vSeeY > ${FLOOR_TOP.toFixed(2)} && vSeeZ < uSee.z - ${PIECE_NEARER.toFixed(2)}) {
    float seeOut = distance(gl_FragCoord.xy, uSee.xy) - uSee.w * ${HOLE.toFixed(2)};
    if (seeOut < 0.0) discard;
    seeRim = 1.0 - smoothstep(0.0, uSee.w * 0.035, seeOut);
    seeShade = 1.0 - smoothstep(0.0, uSee.w * ${(1 - HOLE).toFixed(2)}, seeOut);
  }`,
    )
    .replace(
      "#include <opaque_fragment>",
      `outgoingLight = mix(outgoingLight * (1.0 - 0.08 * seeShade * seeShade), vec3(1.0, 0.96, 0.86), seeRim * 0.14);
  #include <opaque_fragment>`,
    );
};

/** Puts the middle of `g`'s bounding box (in its own space) in every vertex's `seeAt`, once per geometry. */
export function markMiddle(g: THREE.BufferGeometry): void {
  if (g.getAttribute("seeAt")) return;
  if (!g.boundingBox) g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  const n = g.getAttribute("position").count;
  const at = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) at.set([c.x, c.y, c.z, 2], i * 4);
  g.setAttribute("seeAt", new THREE.BufferAttribute(at, 4));
}

/** Teaches the toon materials under `root` to cut themselves away round the player (see `SEE`). */
export function seeThrough(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.nosee) return;
    let patched = false;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial && !mat.transparent) {
        addPatch(mat, "see", patch);
        patched = true;
      }
    if (patched && mesh.geometry.getAttribute("position")) markMiddle(mesh.geometry);
  });
}

/** Probe the head and torso, so a narrow post or a low prop does not open a cutaway. */
export class PlayerOcclusion {
  private readonly caster = new THREE.Raycaster();
  private readonly point = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private readonly hits: THREE.Intersection[] = [];
  private hidden = false;
  private elapsed = Infinity;
  private amount = 0;
  private readonly lastAt = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly lastView = new THREE.Matrix4();
  private readonly lastProjection = new THREE.Matrix4();
  private previous: {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    index: THREE.BufferAttribute | null;
    matrix: THREE.Matrix4;
    version: number;
    indexVersion: number;
    start: number;
    count: number;
  }[] = [];

  constructor(private readonly root: THREE.Object3D) {}

  update(at: THREE.Vector3, camera: THREE.OrthographicCamera, dt: number, calm: boolean): number {
    this.elapsed += dt;
    if (this.elapsed >= 0.08) {
      this.elapsed = 0;
      this.root.updateMatrixWorld();
      const meshes = pickable(this.root).filter((o): o is THREE.Mesh => {
        const mesh = o as THREE.Mesh;
        return (
          !!mesh.geometry.getAttribute("position") &&
          !Array.isArray(mesh.material) &&
          mesh.material.userData.patches?.includes("see")
        );
      });
      let changed =
        !at.equals(this.lastAt) ||
        !camera.matrixWorld.equals(this.lastView) ||
        !camera.projectionMatrix.equals(this.lastProjection) ||
        meshes.length !== this.previous.length;
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i]!;
        const geometry = mesh.geometry;
        const attribute = geometry.getAttribute("position");
        const version =
          (attribute as THREE.BufferAttribute).version ??
          (attribute as THREE.InterleavedBufferAttribute).data.version;
        const old = this.previous[i];
        changed ||=
          !old ||
          old.mesh !== mesh ||
          old.geometry !== geometry ||
          old.position !== attribute ||
          old.index !== geometry.index ||
          !old.matrix.equals(mesh.matrixWorld) ||
          old.version !== version ||
          old.indexVersion !== (geometry.index?.version ?? 0) ||
          old.start !== geometry.drawRange.start ||
          old.count !== geometry.drawRange.count;
        if (old) {
          old.mesh = mesh;
          old.geometry = geometry;
          old.position = attribute;
          old.index = geometry.index;
          old.matrix.copy(mesh.matrixWorld);
          old.version = version;
          old.indexVersion = geometry.index?.version ?? 0;
          old.start = geometry.drawRange.start;
          old.count = geometry.drawRange.count;
        } else
          this.previous.push({
            mesh,
            geometry,
            position: attribute,
            index: geometry.index,
            matrix: mesh.matrixWorld.clone(),
            version,
            indexVersion: geometry.index?.version ?? 0,
            start: geometry.drawRange.start,
            count: geometry.drawRange.count,
          });
      }
      this.previous.length = meshes.length;
      if (changed) {
        this.lastAt.copy(at);
        this.lastView.copy(camera.matrixWorld);
        this.lastProjection.copy(camera.projectionMatrix);
        this.right.setFromMatrixColumn(camera.matrixWorld, 0);
        let blocked = 0;
        for (let row = 0; row < 3; row++) {
          for (let column = -1; column <= 1; column++) {
            this.point.copy(at).addScaledVector(this.right, column * 0.14);
            this.point.y += -0.35 + row * 0.22;
            const depth = -this.projected.copy(this.point).applyMatrix4(camera.matrixWorldInverse).z;
            this.projected.copy(this.point).project(camera);
            this.ndc.set(this.projected.x, this.projected.y);
            this.caster.setFromCamera(this.ndc, camera);
            this.caster.far = depth - NEARER;
            this.hits.length = 0;
            for (const mesh of meshes) {
              occlusionRaycast(mesh, this.caster, this.hits);
              if (this.hits.some((hit) => hit.point.y > FLOOR_TOP)) {
                blocked++;
                break;
              }
              this.hits.length = 0;
            }
          }
        }
        // Hysteresis keeps a roof edge from flickering between adjacent samples while walking.
        this.hidden = blocked >= (this.hidden ? 4 : 5);
      }
    }
    const target = this.hidden ? 1 : 0;
    this.amount = calm ? target : THREE.MathUtils.damp(this.amount, target, this.hidden ? 18 : 12, dt);
    if (Math.abs(this.amount - target) < 0.005) this.amount = target;
    return this.amount;
  }
}
