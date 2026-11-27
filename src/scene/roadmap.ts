import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { box } from './build'
import { ROAD, revealable } from './terrain'

/** One station of the line: a release, or a milestone on the way. */
export type Station = {
  version: string
  name: string
  done: number
  total: number
  /** The release that is out: where the line starts. */
  origin?: boolean
}

const DX = ROAD.bx - ROAD.ax
const DZ = ROAD.bz - ROAD.az
export const ROAD_LENGTH = Math.hypot(DX, DZ)

/** A point of the line in the world: `along` it, `across` it (to the right), `up`. */
export function roadPoint(along: number, across: number, up: number) {
  const dx = DX / ROAD_LENGTH
  const dz = DZ / ROAD_LENGTH
  return new THREE.Vector3(ROAD.ax + dx * along - dz * across, ROAD.y + up, ROAD.az + dz * along + dx * across)
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && g.measureText(next).width > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, 2)
}

function signTexture(s: Station) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const draw = () => {
    const g = c.getContext('2d')!
    const reached = s.origin || (s.total > 0 && s.done >= s.total)
    g.fillStyle = '#21130d'
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = reached ? '#ff8f45' : '#8a6a52'
    g.lineWidth = 5
    g.strokeRect(12, 12, c.width - 24, c.height - 24)
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#f6ecdf'
    g.font = '400 132px "Instrument Serif", Georgia, serif'
    g.fillText(s.version, c.width / 2, 138)
    g.fillStyle = '#c2b3a3'
    g.font = '500 25px "JetBrains Mono", monospace'
    wrap(g, s.name.toUpperCase(), c.width - 70).forEach((line, i) => g.fillText(line, c.width / 2, 188 + i * 32))
    // How much of it is done, as a bar and as a count.
    const share = s.origin ? 1 : s.total ? s.done / s.total : 0
    g.fillStyle = '#4a3528'
    g.fillRect(56, 262, 400, 8)
    g.fillStyle = '#ff8f45'
    g.fillRect(56, 262, 400 * share, 8)
    g.font = '500 20px "JetBrains Mono", monospace'
    g.fillText(s.origin ? 'YOU ARE HERE' : `${s.done} / ${s.total} DONE`, c.width / 2, 298)
    tex.needsUpdate = true
  }
  draw()
  document.fonts.ready.then(draw, () => {})
  return tex
}

/**
 * The roadmap as a railway being laid: the track is real up to where the work
 * has got, and a ghost of itself from there on, with a station per milestone.
 */
export function createRoadmapSite(uReveal: { value: number }) {
  const group = new THREE.Group()
  group.position.set(ROAD.ax, ROAD.y, ROAD.az)
  // The group's +x runs along the line.
  group.rotation.y = -Math.atan2(DZ, DX)

  const wood = revealable(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), uReveal)
  const ghost = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.5, 0.6, 0.16),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    fog: false,
  })
  const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.7, 0.5), fog: false })
  const unlit = new THREE.MeshBasicMaterial({ color: '#3a2c24' })

  let built: THREE.Object3D[] = []
  const add = <T extends THREE.Object3D>(o: T) => {
    built.push(o)
    group.add(o)
    return o
  }

  function setData(stations: Station[]) {
    for (const o of built) {
      group.remove(o)
      o.traverse((c) => {
        const m = c as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.MeshBasicMaterial | undefined
        if (mat?.map) {
          mat.map.dispose()
          mat.dispose()
        }
      })
    }
    built = []
    if (stations.length < 2) return

    const gap = ROAD_LENGTH / (stations.length - 1)
    // How far the rails have got: every finished stretch, and the share done of the one in hand.
    let railhead = 0
    for (let i = 1; i < stations.length; i++) {
      const s = stations[i]
      const share = s.total ? s.done / s.total : 0
      railhead = (i - 1) * gap + share * gap
      if (share < 1) break
    }

    const solid: THREE.BufferGeometry[] = []
    const planned: THREE.BufferGeometry[] = []
    for (let x = 0; x <= ROAD_LENGTH; x += 1.15) {
      const g = box(0.28, 0.14, 2.5, x, 0.07, 0, '#5a3c2a')
      ;(x <= railhead + 0.01 ? solid : planned).push(g)
    }
    for (const z of [-0.75, 0.75]) {
      if (railhead > 0.05) solid.push(box(railhead, 0.13, 0.11, railhead / 2, 0.2, z, '#9aa0a8'))
      const rest = ROAD_LENGTH - railhead
      if (rest > 0.05) planned.push(box(rest, 0.13, 0.11, railhead + rest / 2, 0.2, z, '#ffffff'))
    }

    stations.forEach((s, i) => {
      const x = i * gap
      const reached = x <= railhead + 0.01
      const into = reached ? solid : planned
      into.push(box(5, 0.4, 2.6, x, 0.2, 3.6, '#6d4a31'))
      into.push(box(0.2, 3.6, 0.2, x - 0.4, 1.8, 5.2, '#5a3c2a'), box(0.2, 3.6, 0.2, x + 0.4, 1.8, 3.4, '#5a3c2a'))
      // A lamp post: burning where the line has arrived.
      into.push(box(0.14, 2.6, 0.14, x + 2.1, 1.5, 2.6, '#5a3c2a'))
      const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), reached ? lit : unlit))
      lamp.position.set(x + 2.1, 2.95, 2.6)

      const sign = add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(3.6, 2.25),
          new THREE.MeshBasicMaterial({ map: signTexture(s), fog: false }),
        ),
      )
      sign.position.set(x, 3.6, 4.3)
      // Turned back towards whoever comes along the line.
      sign.rotation.y = -Math.PI / 2 - 0.42
    })

    // The railhead: a lantern on a stake where the work stands today.
    solid.push(box(0.16, 2.2, 0.16, railhead, 1.1, -1.9, '#5a3c2a'))
    const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), lit))
    head.position.set(railhead, 2.4, -1.9)

    add(new THREE.Mesh(mergeGeometries(solid)!, wood))
    if (planned.length) add(new THREE.Mesh(mergeGeometries(planned)!, ghost))
  }

  return { group, setData }
}
