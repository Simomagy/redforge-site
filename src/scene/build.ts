import * as THREE from 'three'

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

/** A box with one colour baked into its vertices, placed by its centre. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.toArray(a, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  g.deleteAttribute('uv')
  return g
}
