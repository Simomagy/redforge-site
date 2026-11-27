import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import logoSvg from '../assets/logo.svg?raw'

const RAISED = 0.95
/** World units per pixel of the 512 px logo. */
const UNIT = 0.0109
/** How far the hammer's handle is tilted in the logo, radians. */
const HANDLE_TILT = 0.42

/**
 * The anvil and the hammer, extruded from the logo's own outline. Both come
 * back upright and in world units: the anvil standing on y = 0, centred on
 * its foot; the hammer with its grip at the origin and its handle along +x.
 */
function logoGeometry() {
  const shapes = new SVGLoader().parse(logoSvg).paths.flatMap((p) => p.toShapes())
  const box = (s: THREE.Shape) => new THREE.Box2().setFromPoints(s.getPoints(3))
  // In the logo the anvil is the lowest piece and the hammer the leftmost one.
  const anvilShape = shapes.reduce((a, b) => (box(b).max.y > box(a).max.y ? b : a))
  const hammerShape = shapes.reduce((a, b) => (box(b).min.x < box(a).min.x ? b : a))
  const extrude = (shape: THREE.Shape, depth: number) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth / UNIT,
      bevelEnabled: true,
      bevelThickness: 3,
      bevelSize: 2.5,
      bevelSegments: 2,
      curveSegments: 3,
    })
    // SVG's y points down: turn the piece over, and centre its thickness.
    return g.rotateX(Math.PI).translate(0, 0, depth / UNIT / 2)
  }

  const ab = box(anvilShape)
  const foot = anvilShape.getPoints(3).filter((p) => p.y > ab.max.y - 6)
  const footX = (Math.min(...foot.map((p) => p.x)) + Math.max(...foot.map((p) => p.x))) / 2
  const anvil = extrude(anvilShape, 1.1).translate(-footX, ab.max.y, 0).scale(UNIT, UNIT, UNIT)

  // The grip is the hammer's lowest-left end.
  const grip = hammerShape.getPoints(3).filter((p) => p.x < box(hammerShape).min.x + 14)
  const gripY = grip.reduce((sum, p) => sum + p.y, 0) / grip.length
  const hammer = extrude(hammerShape, 0.62)
    .translate(-box(hammerShape).min.x - 8, gripY, 0)
    .rotateZ(-HANDLE_TILT)
    .scale(UNIT, UNIT, UNIT)

  anvil.computeBoundingBox()
  hammer.computeBoundingBox()
  // Where the hammer's face is: the lowest stretch of its head.
  const pos = hammer.attributes.position
  const faceY = hammer.boundingBox!.min.y
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < faceY + 0.12) {
      lo = Math.min(lo, pos.getX(i))
      hi = Math.max(hi, pos.getX(i))
    }
  }
  return { anvil, hammer, anvilTop: anvil.boundingBox!.max.y, face: new THREE.Vector2((lo + hi) / 2, faceY) }
}

function softDot() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** CPU particle pool: sparks thrown by the hammer, and slow embers. */
class Sparks {
  readonly points: THREE.Points
  private readonly n: number
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly vel: Float32Array
  private readonly life: Float32Array
  private readonly span: Float32Array
  private next = 0

  constructor(n: number) {
    this.n = n
    this.pos = new Float32Array(n * 3)
    this.col = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n)
    this.span = new Float32Array(n).fill(1)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60)
    const mat = new THREE.PointsMaterial({
      size: 0.13,
      map: softDot(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  emit(origin: THREE.Vector3, count: number, speed: number, up: number, life: number) {
    for (let k = 0; k < count; k++) {
      const i = this.next
      this.next = (this.next + 1) % this.n
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.25 + Math.random() * 0.75)
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.3
      this.pos[i * 3 + 1] = origin.y
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2
      this.vel[i * 3] = Math.cos(a) * s
      this.vel[i * 3 + 1] = up * (0.3 + Math.random())
      this.vel[i * 3 + 2] = Math.sin(a) * s
      this.span[i] = this.life[i] = life * (0.4 + Math.random() * 0.6)
    }
  }

  update(dt: number, gravity: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0
        continue
      }
      this.life[i] -= dt
      const j = i * 3
      this.vel[j + 1] -= gravity * dt
      this.pos[j] += this.vel[j] * dt
      this.pos[j + 1] += this.vel[j + 1] * dt
      this.pos[j + 2] += this.vel[j + 2] * dt
      if (this.pos[j + 1] < 0.03 && this.vel[j + 1] < 0) {
        this.pos[j + 1] = 0.03
        this.vel[j + 1] *= -0.32
        this.vel[j] *= 0.6
        this.vel[j + 2] *= 0.6
      }
      const t = Math.max(0, this.life[i] / this.span[i])
      // White-hot, then orange, then a dying red.
      this.col[j] = 3.2 * t + 0.25
      this.col[j + 1] = 2.0 * t * t
      this.col[j + 2] = 0.9 * t * t * t
      if (this.life[i] <= 0) this.col[j] = 0
    }
    this.points.geometry.attributes.position.needsUpdate = true
    this.points.geometry.attributes.color.needsUpdate = true
  }
}

export function createForge(mobile: boolean) {
  const group = new THREE.Group()

  const metal = new THREE.MeshStandardMaterial({
    color: '#c4130d',
    roughness: 0.42,
    metalness: 0.25,
    emissive: '#3d0300',
    emissiveIntensity: 0.55,
  })

  const logo = logoGeometry()
  group.add(new THREE.Mesh(logo.anvil, metal))

  // The piece being forged: glows on every blow, then cools.
  const ingotMat = new THREE.MeshBasicMaterial({ color: '#ff5a14' })
  const ingot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.34), ingotMat)
  ingot.position.set(-0.25, logo.anvilTop + 0.06, 0)
  group.add(ingot)
  const IMPACT = new THREE.Vector3(ingot.position.x, logo.anvilTop + 0.14, 0)

  // At rest the hammer's face lies flat on the piece.
  const hammer = new THREE.Mesh(logo.hammer, metal)
  hammer.position.set(IMPACT.x - logo.face.x, logo.anvilTop + 0.12 - logo.face.y, 0)
  hammer.rotation.z = RAISED
  group.add(hammer)

  const light = new THREE.PointLight('#ff6a1f', 0, 40, 1.6)
  light.position.set(IMPACT.x, IMPACT.y + 0.7, 0.9)
  group.add(light)

  const sparks = new Sparks(mobile ? 320 : 700)
  group.add(sparks.points)

  const PERIOD = 2.7
  let clock = 1.1
  let heat = 0.35
  let struck = false
  const emberAt = new THREE.Vector3()

  /** Angle of the hammer over one blow: slow lift, fast fall, small rebound. */
  function swing(t: number) {
    if (t < 0.62) {
      const u = t / 0.62
      return RAISED * (u * u * (3 - 2 * u))
    }
    if (t < 0.72) {
      const u = (t - 0.62) / 0.1
      return RAISED * (1 - u * u * u)
    }
    if (t < 0.86) {
      const u = (t - 0.72) / 0.14
      return 0.09 * Math.sin(u * Math.PI)
    }
    return 0
  }

  function applyHeat() {
    ingotMat.color.setRGB(0.5 + heat * 5.5, 0.08 + heat * 1.9, 0.02 + heat * 0.5)
    light.intensity = 12 + heat * 75
    metal.emissiveIntensity = 0.55 + heat * 0.9
  }

  return {
    group,
    get heat() {
      return heat
    },
    /** A frozen moment for reduced motion: hammer raised, one spray of sparks hanging. */
    freeze() {
      hammer.rotation.z = RAISED * 0.8
      heat = 0.5
      applyHeat()
      sparks.emit(IMPACT, 140, 4.5, 4.5, 1.6)
      sparks.update(0.22, 9.8)
    },
    update(dt: number, activity: number) {
      clock += dt
      const t = (clock % PERIOD) / PERIOD
      hammer.rotation.z = swing(t)
      if (t >= 0.72 && !struck) {
        struck = true
        heat = 1
        sparks.emit(IMPACT, Math.round((mobile ? 70 : 150) * (0.35 + 0.65 * activity)), 5.5, 5.2, 1.7)
      }
      if (t < 0.5) struck = false
      heat *= Math.exp(-dt * 1.6)
      if (Math.random() < dt * 9 * activity) {
        const a = Math.random() * Math.PI * 2
        const d = 1 + Math.random() * 6
        emberAt.set(Math.cos(a) * d, 0.1 + Math.random() * 1.5, Math.sin(a) * d)
        sparks.emit(emberAt, 1, 0.25, 0.9, 3.5)
      }
      applyHeat()
      sparks.update(dt, 5.5)
    },
  }
}
