import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createForge } from './forge'
import { createPartnerSite } from './partner'
import { createProps } from './props'
import { ROAD_LENGTH, createRoadmapSite, roadPoint, type Station } from './roadmap'
import { createSky } from './sky'
import { ROAD, SITES, createTerrain, heightAt } from './terrain'

export const CHAPTER_COUNT = 9
/** The chapter whose stop is the partner's house. */
const PARTNER_AT = 7

export type WorldOptions = {
  reducedMotion: boolean
  mobile: boolean
  /** Fractional chapter index, 0 to CHAPTER_COUNT - 1, written by the page on scroll. */
  progress: { current: number }
  /** Painted on the sign of the partner's house. */
  partner: { name: string; tagline: string; logo: string }
  onFrame?: (info: { x: number; y: number; z: number; hour: number }) => void
}

type Mood = {
  top: string
  horizon: string
  fog: string
  sun: string
  sunPower: number
  amb: string
  ambPower: number
  /** Sun azimuth and elevation, degrees. */
  az: number
  el: number
  stars: number
  fogNear: number
  fogFar: number
  hour: number
}

// The roadmap's line runs straight into its sunset.
const ROAD_AZ = THREE.MathUtils.radToDeg(Math.atan2(ROAD.bx - ROAD.ax, ROAD.bz - ROAD.az))

// One mood per chapter; the sky is blended between them as the camera flies.
const MOODS: Mood[] = [
  { top: '#040203', horizon: '#150605', fog: '#090403', sun: '#5a6a9a', sunPower: 0.12, amb: '#2a1612', ambPower: 0.25, az: 200, el: 30, stars: 0.5, fogNear: 30, fogFar: 260, hour: 4.5 },
  { top: '#1b2548', horizon: '#e0763f', fog: '#3a2226', sun: '#ff9a5c', sunPower: 1.1, amb: '#4a4266', ambPower: 0.7, az: 250, el: 13, stars: 0.25, fogNear: 60, fogFar: 430, hour: 6 },
  { top: '#5f93b8', horizon: '#f0d7ae', fog: '#dcc4a0', sun: '#fff0d6', sunPower: 1.5, amb: '#8fa3b8', ambPower: 0.75, az: 300, el: 38, stars: 0, fogNear: 70, fogFar: 460, hour: 9.5 },
  { top: '#4f8fc4', horizon: '#f3e2c0', fog: '#e3cfae', sun: '#fff6e4', sunPower: 1.7, amb: '#93a8bd', ambPower: 0.8, az: 340, el: 58, stars: 0, fogNear: 80, fogFar: 480, hour: 12.5 },
  { top: '#2b3440', horizon: '#8a8478', fog: '#716c64', sun: '#d9d4c8', sunPower: 0.75, amb: '#6f7885', ambPower: 0.7, az: 20, el: 42, stars: 0, fogNear: 50, fogFar: 380, hour: 15.5 },
  { top: '#2c2f5a', horizon: '#ff9448', fog: '#b56a40', sun: '#ffb066', sunPower: 1.5, amb: '#6a557a', ambPower: 0.6, az: 62, el: 9, stars: 0.1, fogNear: 70, fogFar: 520, hour: 18.5 },
  { top: '#27295a', horizon: '#ff7f3f', fog: '#a85a3c', sun: '#ffa055', sunPower: 1.3, amb: '#6a557a', ambPower: 0.7, az: ROAD_AZ, el: 5, stars: 0.12, fogNear: 70, fogFar: 520, hour: 19.4 },
  { top: '#0b1030', horizon: '#c2523a', fog: '#3a2232', sun: '#ff8a55', sunPower: 0.55, amb: '#5c5c92', ambPower: 0.9, az: 78, el: 3, stars: 0.5, fogNear: 50, fogFar: 430, hour: 20.5 },
  { top: '#03050c', horizon: '#141026', fog: '#0a0911', sun: '#7f93c9', sunPower: 0.3, amb: '#262a44', ambPower: 0.45, az: 120, el: 40, stars: 1, fogNear: 40, fogFar: 380, hour: 23 },
]

// Sideways shift of the picture per chapter, as a share of the width: away from that chapter's panel.
const SHIFT_X = [-0.2, -0.17, 0.17, -0.17, 0.17, -0.17, -0.19, 0.25, -0.2]

const END = CHAPTER_COUNT - 1

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

export function createWorld(canvas: HTMLCanvasElement, opts: WorldOptions) {
  const { mobile, reducedMotion } = opts
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  let pixelRatio = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2)
  renderer.setPixelRatio(pixelRatio)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#000000', 60, 400)
  const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 2400)

  const sun = new THREE.DirectionalLight('#ffffff', 1)
  const hemi = new THREE.HemisphereLight('#ffffff', '#3a2416', 1)
  scene.add(sun, sun.target, hemi)

  const terrain = createTerrain(mobile ? 170 : 300)
  const tu = terrain.uniforms
  scene.add(terrain.mesh)

  const sky = createSky(mobile ? 700 : 1600)
  scene.add(sky.group)

  const forge = createForge(mobile)
  scene.add(forge.group)


  // --- Camera path: one key per chapter ----------------------------------
  const T = SITES.town
  const F = SITES.fence
  const P = SITES.partner
  const modeCenter = new THREE.Vector3(214, 0, -236)
  modeCenter.y = heightAt(modeCenter.x, modeCenter.z)
  tu.uModeCenter.value.copy(modeCenter)

  const keys: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(4.6, 2.5, 8.4), new THREE.Vector3(0, 1.75, 0)],
    [new THREE.Vector3(-22, 36, 64), new THREE.Vector3(6, 0, -40)],
    [new THREE.Vector3(T.x + 12, T.y + 7, T.z + 31), new THREE.Vector3(T.x - 1, T.y + 2.5, T.z + 2)],
    [new THREE.Vector3(F.x - 12, F.y + 5.5, F.z + 23), new THREE.Vector3(F.x, F.y + 1, F.z)],
    [new THREE.Vector3(modeCenter.x - 56, 0, modeCenter.z - 40), modeCenter.clone().setY(modeCenter.y + 4)],
    [new THREE.Vector3(-78, 64, -190), new THREE.Vector3(0, 0, -30)],
    [roadPoint(-27, -8, 10), roadPoint(30, 2, 1.2)],
    [new THREE.Vector3(P.x - 27, P.y + 21, P.z + 23), new THREE.Vector3(P.x, P.y + 2.2, P.z + 0.5)],
    [new THREE.Vector3(-5.8, 3.1, 9.2), new THREE.Vector3(0, 1.75, 0)],
  ]
  keys[4][0].y = Math.max(heightAt(keys[4][0].x, keys[4][0].z), modeCenter.y) + 22
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[0]), false, 'catmullrom', 0.35)
  const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'catmullrom', 0.35)

  const props = createProps(tu.uReveal, mobile, [
    ...posCurve.getPoints(220),
    ...Array.from({ length: 30 }, (_, i) => roadPoint((i / 29) * ROAD_LENGTH, 2, 0)),
  ])
  scene.add(props.group)
  const partner = createPartnerSite(tu.uReveal, opts.partner)
  scene.add(partner.group)
  const roadmap = createRoadmapSite(tu.uReveal)
  scene.add(roadmap.group)

  // Lowest height the camera may fly at along the path, smoothed so that
  // clearing a mesa is a gentle climb and not a bump.
  const CLEAR_N = 240
  const clearance = new Float32Array(CLEAR_N + 1)
  {
    const raw = new Float32Array(CLEAR_N + 1)
    const p = new THREE.Vector3()
    for (let i = 0; i <= CLEAR_N; i++) {
      posCurve.getPoint(i / CLEAR_N, p)
      raw[i] = heightAt(p.x, p.z) + 4
    }
    const R = 7
    for (let i = 0; i <= CLEAR_N; i++) {
      let sum = 0
      for (let j = -R; j <= R; j++) {
        let m = -Infinity
        for (let k = -R; k <= R; k++) m = Math.max(m, raw[Math.min(CLEAR_N, Math.max(0, i + j + k))])
        sum += m
      }
      clearance[i] = sum / (R * 2 + 1)
    }
  }

  // --- Post: bloom only where there is power to spare ---------------------
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (!mobile) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 1.0)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  let width = 1
  let height = 1
  function resize() {
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    composer?.setPixelRatio(pixelRatio)
    composer?.setSize(width, height)
    camera.aspect = width / height
    camera.fov = width < height ? 58 : 46
    dirty = true
  }

  const cA = new THREE.Color()
  const cB = new THREE.Color()
  const mix = (a: string, b: string, t: number, out: THREE.Color) => out.copy(cA.set(a)).lerp(cB.set(b), t)
  const sunDir = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()

  let f = opts.progress.current
  let dirty = true
  let time = 0

  function applyMood(fi: number) {
    const i = Math.min(MOODS.length - 2, Math.floor(fi))
    const t = ease(fi - i)
    const a = MOODS[i]
    const b = MOODS[i + 1]
    mix(a.top, b.top, t, sky.uniforms.uTop.value)
    mix(a.horizon, b.horizon, t, sky.uniforms.uHorizon.value)
    mix(a.fog, b.fog, t, tu.uFogCol.value)
    sky.uniforms.uGround.value.copy(tu.uFogCol.value)
    ;(scene.fog as THREE.Fog).color.copy(tu.uFogCol.value)
    const fogNear = lerp(a.fogNear, b.fogNear, t)
    const fogFar = lerp(a.fogFar, b.fogFar, t)
    tu.uFogNear.value = (scene.fog as THREE.Fog).near = fogNear
    tu.uFogFar.value = (scene.fog as THREE.Fog).far = fogFar

    const az = THREE.MathUtils.degToRad(lerp(a.az, b.az, t))
    const el = THREE.MathUtils.degToRad(lerp(a.el, b.el, t))
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
    const power = lerp(a.sunPower, b.sunPower, t)
    mix(a.sun, b.sun, t, sun.color)
    sun.intensity = power * 2.2
    tu.uSunDir.value.copy(sunDir)
    sky.uniforms.uSunDir.value.copy(sunDir)
    tu.uSunCol.value.copy(sun.color).multiplyScalar(power)
    sky.uniforms.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(power, 1.2))

    const ambPower = lerp(a.ambPower, b.ambPower, t)
    mix(a.amb, b.amb, t, hemi.color)
    hemi.intensity = ambPower * 2.4
    tu.uAmbCol.value.copy(hemi.color).multiplyScalar(ambPower)
    sky.starMat.opacity = lerp(a.stars, b.stars, t)
    return lerp(a.hour, b.hour, t)
  }

  function frame(dt: number) {
    const target = Math.min(CHAPTER_COUNT - 1, Math.max(0, opts.progress.current || 0))
    f = reducedMotion ? target : f + (target - f) * (1 - Math.exp(-dt * 4.5))
    if (Math.abs(target - f) < 0.0004) f = target

    const hour = applyMood(f)

    // The ember front runs out from the anvil during the first leg.
    tu.uReveal.value = 30 + Math.pow(ease(f / 1.05), 1.3) * 760
    tu.uGrid.value = 0.22 * ease((f - 0.15) / 0.5) * (1 - ease((f - 1.2) / 0.5)) + 0.3 * ease((f - 1.4) / 0.3) * (1 - ease((f - 3.5) / 0.3))
    tu.uModeRadius.value = 95 * ease((f - 3.45) / 0.45) * (1 - ease((f - 4.5) / 0.4))

    // Forge: lit and loud at both ends of the trip, a far ember in between.
    const near = Math.max(1 - f / 1.2, (f - (END - 0.9)) / 0.9, 0)
    tu.uForge.value = (0.1 + forge.heat * 1.1) * clamp01(near + 0.15)
    if (!reducedMotion) forge.update(dt, clamp01(near))
    props.update(f, time)
    partner.update(f, PARTNER_AT, time)

    const u = f / (CHAPTER_COUNT - 1)
    posCurve.getPoint(u, pos)
    lookCurve.getPoint(u, look)
    const ci = Math.min(CLEAR_N - 1, Math.floor(u * CLEAR_N))
    const floor = lerp(clearance[ci], clearance[ci + 1], u * CLEAR_N - ci)
    // Near the anvil the keys already sit low on purpose.
    const lift = ease(f / 0.5) * (1 - ease((f - (END - 0.6)) / 0.5))
    pos.y = Math.max(pos.y, lerp(pos.y, floor, lift))
    if (!reducedMotion) {
      pos.x += Math.sin(time * 0.31) * 0.16
      pos.y += Math.sin(time * 0.43) * 0.1
    }
    camera.position.copy(pos)
    camera.lookAt(look)

    // Keep the subject clear of the text: beside the panel on wide screens, above it on tall ones.
    const oi = Math.min(CHAPTER_COUNT - 2, Math.floor(f))
    const ot = ease(f - oi)
    if (width >= height * 1.15) {
      camera.setViewOffset(width, height, width * lerp(SHIFT_X[oi], SHIFT_X[oi + 1], ot), 0, width, height)
    } else {
      const ends = Math.max(1 - f, f - (CHAPTER_COUNT - 2), 0)
      camera.setViewOffset(width, height, 0, height * (0.12 + 0.11 * ease(ends)), width, height)
    }
    camera.updateProjectionMatrix()

    sky.group.position.copy(camera.position)
    sun.position.copy(look).addScaledVector(sunDir, 200)
    sun.target.position.copy(look)

    if (bloom) bloom.strength = 0.5 + 0.2 * clamp01(near)
    if (composer) composer.render(dt)
    else renderer.render(scene, camera)

    opts.onFrame?.({ x: pos.x, y: pos.y, z: pos.z, hour })
  }

  // --- Loop, with a pixel-ratio governor to hold the frame rate -----------
  let raf = 0
  let last = performance.now()
  let slow = 0
  let fast = 0
  let lastTarget = -1
  function tick(now: number) {
    raf = requestAnimationFrame(tick)
    if (document.hidden) {
      last = now
      return
    }
    const raw = (now - last) / 1000
    last = now
    const dt = Math.min(raw, 0.05)
    time += dt

    if (reducedMotion) {
      // Nothing moves on its own: draw only when the scroll position changed.
      if (!dirty && opts.progress.current === lastTarget) return
      lastTarget = opts.progress.current
      dirty = false
      frame(dt)
      return
    }

    if (raw > 0.024) slow++
    else fast++
    if (slow + fast >= 90) {
      if (slow > 45 && pixelRatio > 0.75) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25)
        resize()
      }
      slow = fast = 0
    }
    frame(dt)
  }

  resize()
  if (reducedMotion) forge.freeze()

  if (import.meta.env.DEV) {
    // Dev console helpers: __world.jump() skips the camera easing, __world.bench() times a frame.
    Object.assign(window, {
      __world: {
        jump() {
          f = opts.progress.current
          frame(0.016)
        },
        bench(n = 60) {
          const gl = renderer.getContext()
          const t0 = performance.now()
          for (let i = 0; i < n; i++) {
            frame(0.016)
            gl.finish()
          }
          return (performance.now() - t0) / n
        },
      },
    })
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  raf = requestAnimationFrame(tick)

  return {
    /** Lays the roadmap's line again, for new data from GitHub. */
    setRoadmap(stations: Station[]) {
      roadmap.setData(stations)
      dirty = true
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      composer?.dispose()
      renderer.dispose()
    },
  }
}
