import * as THREE from "three";

const basis = new THREE.Matrix4();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const offset = new THREE.Vector3();

/** Keep the shadow texel grid fixed in world space while its light follows the camera. */
export function stabilizeShadow(light: THREE.DirectionalLight): void {
  const camera = light.shadow.camera;
  const size = light.shadow.mapSize;
  const texelX = (camera.right - camera.left) / (camera.zoom * size.x);
  const texelY = (camera.top - camera.bottom) / (camera.zoom * size.y);
  basis.lookAt(light.position, light.target.position, camera.up);
  right.setFromMatrixColumn(basis, 0);
  up.setFromMatrixColumn(basis, 1);
  const x = light.target.position.dot(right);
  const y = light.target.position.dot(up);
  offset.copy(right).multiplyScalar(Math.round(x / texelX) * texelX - x);
  offset.addScaledVector(up, Math.round(y / texelY) * texelY - y);
  light.position.add(offset);
  light.target.position.add(offset);
}
