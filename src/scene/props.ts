import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SITES, TERRAIN_CENTER, fbm, heightAt, revealable } from './terrain'

type U = { value: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

/** Deterministic random, so the world is the same on every visit. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function cabinGeometry(w: number, h: number, d: number) {
  const body = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).toNonIndexed()
  const roof = new THREE.CylinderGeometry(0, 1, 1, 4, 1)
    .rotateY(Math.PI / 4)
    .scale(w * 0.82, h * 0.55, d * 0.82)
    .translate(0, h + h * 0.275, 0)
    .toNonIndexed()
  const colors = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex)
    const n = g.attributes.position.count
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.toArray(a, i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(a, 3))
    g.deleteAttribute('uv')
    return g
  }
  return mergeGeometries([colors(body, '#8a6244'), colors(roof, '#3f2a22')])!
}

function createTrees(count: number, uReveal: U, avoid: THREE.Vector3[]) {
  const geo = new THREE.ConeGeometry(1, 3.6, 5).translate(0, 1.8, 0)
  const mat = revealable(new THREE.MeshLambertMaterial({ flatShading: true }), uReveal)
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const rand = rng(7)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const tint = new THREE.Color()
  let placed = 0
  let guard = 0
  while (placed < count && guard++ < count * 40) {
    const x = TERRAIN_CENTER.x + (rand() - 0.5) * 760
    const z = TERRAIN_CENTER.z + (rand() - 0.5) * 760
    if (fbm(x * 0.012 + 40, z * 0.012 - 12, 2) < 0.5) continue
    let clear = true
    for (const s of Object.values(SITES)) {
      if (Math.hypot(x - s.x, z - s.z) < s.r * 1.25) clear = false
    }
    // Nothing grows where the camera flies low.
    for (const p of avoid) {
      if (Math.abs(p.x - x) < 9 && Math.abs(p.z - z) < 9) clear = false
    }
    if (!clear) continue
    const y = heightAt(x, z)
    if (Math.abs(heightAt(x + 2, z) - y) + Math.abs(heightAt(x, z + 2) - y) > 1.6) continue
    const s = 0.7 + rand() * 0.9
    q.setFromAxisAngle(up, rand() * Math.PI)
    m.compose(new THREE.Vector3(x, y - 0.1, z), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.6), s))
    mesh.setMatrixAt(placed, m)
    mesh.setColorAt(placed, tint.setHSL(0.2 + rand() * 0.07, 0.36, 0.2 + rand() * 0.1))
    placed++
  }
  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

function createGizmo() {
  const group = new THREE.Group()
  const move = new THREE.Group()
  const axis = (color: string, rot: THREE.Euler) => {
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, fog: false, transparent: true })
    const g = mergeGeometries([
      new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8).translate(0, 1.6, 0),
      new THREE.ConeGeometry(0.24, 0.7, 12).translate(0, 3.5, 0),
    ])!
    const a = new THREE.Mesh(g, mat)
    a.rotation.copy(rot)
    a.renderOrder = 20
    return a
  }
  move.add(
    axis('#ff4a3d', new THREE.Euler(0, 0, -Math.PI / 2)),
    axis('#7ad13a', new THREE.Euler(0, 0, 0)),
    axis('#3d8bff', new THREE.Euler(Math.PI / 2, 0, 0)),
  )
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.06, 8, 72).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#7ad13a', depthTest: false, fog: false, transparent: true }),
  )
  ring.renderOrder = 20
  group.add(move, ring)
  return { group, move, ring }
}

export function createProps(uReveal: U, mobile: boolean, avoid: THREE.Vector3[]) {
  const group = new THREE.Group()
  group.add(createTrees(mobile ? 900 : 2200, uReveal, avoid))

  const wood = revealable(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), uReveal)

  // --- Town: a handful of cabins, one of them being edited. ---------------
  const T = SITES.town
  const rand = rng(21)
  const lots: [number, number, number, number, number, number][] = [
    [-13, -6, 5, 3.2, 4, 0.1],
    [-5, -8, 6.5, 3.6, 4.5, -0.05],
    [5, -7, 5, 3, 4, 0.08],
    [13, -5, 5.5, 3.4, 5, -0.12],
    [-17, 8, 6, 3.2, 4.5, 3.1],
    [15, -14, 5, 3, 4, 0.2],
  ]
  for (const [x, z, w, h, d, r] of lots) {
    const c = new THREE.Mesh(cabinGeometry(w, h, d), wood)
    c.position.set(T.x + x, T.y, T.z + z)
    c.rotation.y = r + (rand() - 0.5) * 0.1
    group.add(c)
  }
  // The church, a taller landmark at the end of the street.
  const church = new THREE.Mesh(
    mergeGeometries([cabinGeometry(5, 4.4, 8), cabinGeometry(2, 8, 2).translate(0, 0, 5)])!,
    wood,
  )
  church.position.set(T.x - 23, T.y, T.z - 1)
  church.rotation.y = Math.PI / 2
  group.add(church)

  const hero = new THREE.Mesh(cabinGeometry(5.5, 3.4, 4.5), wood)
  const heroHome = new THREE.Vector3(T.x - 1, T.y, T.z + 7)
  hero.position.copy(heroHome)
  group.add(hero)

  const selection = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(6.1, 5.6, 5.1).translate(0, 2.8, 0)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(3.0, 1.5, 0.35), fog: false, transparent: true }),
  )
  hero.add(selection)
  const gizmo = createGizmo()
  gizmo.group.position.y = 1.2
  const gizmoHolder = new THREE.Group()
  gizmoHolder.add(gizmo.group)
  group.add(gizmoHolder)

  // --- Fence: a row that grows one drag-copy at a time. -------------------
  const F = SITES.fence
  const post = (x: number) => new THREE.BoxGeometry(0.22, 1.5, 0.22).translate(x, 0.75, 0)
  const rail = (y: number) => new THREE.BoxGeometry(3, 0.14, 0.1).translate(0, y, 0)
  const fenceGeo = mergeGeometries([post(-1.5), post(1.5), rail(0.55), rail(1.15)])!.toNonIndexed()
  {
    const c = new THREE.Color('#9a7350')
    const n = fenceGeo.attributes.position.count
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.toArray(a, i * 3)
    fenceGeo.setAttribute('color', new THREE.BufferAttribute(a, 3))
  }
  const FENCE_N = 9
  const fences: THREE.Mesh[] = []
  for (let i = 0; i < FENCE_N; i++) {
    const m = new THREE.Mesh(fenceGeo, wood)
    m.position.set(F.x - 12 + i * 3, F.y, F.z)
    m.scale.setScalar(0.0001)
    fences.push(m)
    group.add(m)
  }
  const ghost = new THREE.Mesh(
    fenceGeo,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 1.0, 0.3),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      fog: false,
    }),
  )
  group.add(ghost)

  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10).translate(0, 0.55, 0)
  const barrelMat = revealable(new THREE.MeshLambertMaterial({ color: '#6e4a2c', flatShading: true }), uReveal)
  const barrels: THREE.Mesh[] = []
  for (const [x, z] of [[-8, 4], [-7, 4.7], [-7.3, 3.5], [1, 5], [1.9, 5.4], [8, 3.6]] as const) {
    const b = new THREE.Mesh(barrelGeo, barrelMat)
    b.position.set(F.x + x, F.y, F.z + z)
    b.scale.setScalar(0.0001)
    barrels.push(b)
    group.add(b)
  }

  const pop = (x: number) => {
    const t = clamp01(x)
    return t === 0 ? 0.0001 : 1 + Math.pow(1 - t, 2) * Math.sin(t * 9) * 0.35 - Math.pow(1 - t, 3)
  }

  return {
    group,
    /** f is the fractional chapter index (2 = Edit, 3 = Place). */
    update(f: number, time: number) {
      // Edit: slide the cabin along X, then turn it.
      const slide = ease((f - 1.55) / 0.5)
      const turn = ease((f - 2.1) / 0.4)
      hero.position.set(heroHome.x - 7 + slide * 7, heroHome.y, heroHome.z)
      hero.rotation.y = turn * 0.6
      gizmoHolder.position.copy(hero.position)
      const on = ease((f - 1.25) / 0.2) * (1 - ease((f - 2.7) / 0.2))
      gizmoHolder.visible = selection.visible = on > 0.01
      ;(selection.material as THREE.LineBasicMaterial).opacity = on
      const rotating = turn > 0 && turn < 1
      gizmo.move.visible = !rotating
      gizmo.ring.visible = rotating
      gizmo.group.scale.setScalar(on * (1 + Math.sin(time * 2.2) * 0.015))

      // Place: one more fence for every bit of scroll.
      const grow = clamp01((f - 2.5) / 0.6) * FENCE_N
      for (let i = 0; i < FENCE_N; i++) fences[i].scale.setScalar(pop(grow - i))
      const nextSlot = Math.min(FENCE_N - 1, Math.floor(grow) + 1)
      ghost.visible = grow > 0 && grow < FENCE_N - 1
      ghost.position.set(F.x - 12 + nextSlot * 3, F.y, F.z)
      for (let i = 0; i < barrels.length; i++) {
        barrels[i].scale.setScalar(pop((f - 2.75 - i * 0.07) / 0.12))
      }
    },
  }
}
