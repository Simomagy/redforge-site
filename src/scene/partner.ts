import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { box, ease } from './build'
import { SITES, revealable } from './terrain'

/** The painted board over the porch, with the studio's name. */
function signTexture(name: string, tagline: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const draw = () => {
    const g = c.getContext('2d')!
    g.fillStyle = '#24140e'
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = '#e8b27a'
    g.lineWidth = 5
    g.strokeRect(16, 16, c.width - 32, c.height - 32)
    g.fillStyle = '#f6ecdf'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 132
    do {
      g.font = `400 ${size}px "Instrument Serif", Georgia, serif`
      size -= 4
    } while (g.measureText(name).width > c.width - 110)
    g.fillText(name, c.width / 2, 108)
    g.fillStyle = '#ff8f45'
    g.font = '500 30px "JetBrains Mono", monospace'
    g.fillText(tagline.toUpperCase().split('').join(' '), c.width / 2, 200)
    tex.needsUpdate = true
  }
  draw()
  // The web fonts may land after the first paint: draw again with them.
  Promise.all([
    document.fonts.load('400 120px "Instrument Serif"'),
    document.fonts.load('500 30px "JetBrains Mono"'),
  ]).then(draw, () => {})
  return tex
}

/**
 * The partner's house: a frontier building whose roof swings open on the
 * interior, with its rooms and portals outlined as the editor shows them.
 */
export function createPartnerSite(uReveal: { value: number }, name: string, tagline: string) {
  const S = SITES.partner
  const group = new THREE.Group()
  group.position.set(S.x, S.y, S.z)
  group.rotation.y = -0.15

  const wood = revealable(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), uReveal)
  const WALL = '#8a6244'
  const TRIM = '#5a3c2a'
  const H = 4

  const shell = mergeGeometries([
    box(10.6, 0.3, 8.6, 0, 0.15, 0, '#6d4a31'), // floor
    box(10, H, 0.3, 0, H / 2 + 0.3, -4, WALL), // back
    box(0.3, H, 8, 5, H / 2 + 0.3, 0, WALL), // east
    box(2, H, 0.3, -4, H / 2 + 0.3, 4, WALL), // front, left of the door
    box(6, H, 0.3, 2, H / 2 + 0.3, 4, WALL), // front, right of the door
    box(2, 1.2, 0.3, -2, H - 0.3, 4, WALL), // lintel
    box(10.8, 2.3, 0.3, 0, H + 1.45, 4.05, WALL), // false front
    box(11.2, 0.25, 0.5, 0, H + 2.7, 4.05, TRIM), // cornice
    // Inside: two partitions make three rooms.
    box(0.2, H - 0.4, 6.2, 1, H / 2 + 0.1, -0.9, '#9a7350'),
    box(2.4, H - 0.4, 0.2, 3.8, H / 2 + 0.1, -0.5, '#9a7350'),
    // Saloon: bar, tables, a rug.
    box(0.8, 1.1, 4.2, -3.9, 0.85, -1.4, TRIM),
    box(3.2, 0.04, 2.2, -1.4, 0.32, 1.6, '#7a2318'),
    box(1, 0.8, 1, -1.9, 0.7, 1.7, '#4a3020'),
    box(1, 0.8, 1, -0.8, 0.7, -1.9, '#4a3020'),
    box(1, 0.8, 1, -2.4, 0.7, -0.4, '#4a3020'),
    // Office and bedroom.
    box(1.8, 0.85, 0.9, 3.5, 0.72, 2.9, '#4a3020'),
    box(1.5, 0.55, 2.3, 4, 0.58, -2.6, '#b9a58c'),
    box(1.5, 0.75, 0.4, 4, 0.9, -3.6, TRIM),
    // Porch: deck, posts, awning.
    box(10.6, 0.3, 2.4, 0, 0.15, 5.4, '#6d4a31'),
    ...[-5, -1.7, 1.7, 5].map((x) => box(0.22, 3, 0.22, x, 1.8, 6.4, TRIM)),
    box(11, 0.18, 2.7, 0, 3.4, 5.4, TRIM),
  ])!
  group.add(new THREE.Mesh(shell, wood))

  // The west wall sinks into the ground with its windows: a doll's house cutaway.
  const westWall = new THREE.Mesh(box(0.3, H, 7.7, -5, H / 2 + 0.3, 0, WALL), wood)
  group.add(westWall)

  // The roof is hinged on the back wall and opens like a lid.
  const hinge = new THREE.Group()
  hinge.position.set(0, H + 0.3, -4.15)
  const roof = new THREE.Mesh(
    mergeGeometries([
      box(10.7, 0.25, 8.2, 0, 0.12, 4.1, '#3f2a22'),
      box(8.6, 0.25, 6, 0, 0.37, 4.1, '#4a3128'),
    ])!,
    wood,
  )
  hinge.add(roof)
  group.add(hinge)

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.1),
    new THREE.MeshBasicMaterial({ map: signTexture(name, tagline), fog: false }),
  )
  sign.position.set(0, H + 1.45, 4.22)
  group.add(sign)

  // Windows and the door glow from the lamps inside.
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.05, 0.4), fog: false })
  const windows = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(1.3, 1.5, 0.08).translate(1.6, 2.5, 4.17),
      new THREE.BoxGeometry(1.3, 1.5, 0.08).translate(3.7, 2.5, 4.17),
    ])!,
    glow,
  )
  group.add(windows)
  westWall.add(
    new THREE.Mesh(
      mergeGeometries([
        new THREE.BoxGeometry(0.08, 1.5, 1.3).translate(-5.17, 2.5, -1.8),
        new THREE.BoxGeometry(0.08, 1.5, 1.3).translate(-5.17, 2.5, 1.6),
      ])!,
      glow,
    ),
  )

  const porchLamp = new THREE.PointLight('#ffb066', 0, 26, 1.5)
  porchLamp.position.set(-3, 2.6, 7.2)
  group.add(porchLamp)

  const lamp = new THREE.PointLight('#ffb066', 0, 30, 1.5)
  lamp.position.set(-1, 3.2, 0)
  group.add(lamp)

  // Rooms and portals, as Interior Instance mode draws them.
  const roomEdges = (w: number, d: number, x: number, z: number) =>
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, H - 0.5, d).translate(x, H / 2 + 0.1, z))
  const rooms = new THREE.LineSegments(
    mergeGeometries([roomEdges(5.6, 7.5, -1.95, 0), roomEdges(3.6, 4.1, 3.05, 1.75), roomEdges(3.6, 3.1, 3.05, -2.25)])!,
    new THREE.LineBasicMaterial({ color: new THREE.Color(3, 1.5, 0.35), transparent: true, fog: false }),
  )
  const portalMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.35, 1.5, 2),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  })
  const portals = new THREE.Mesh(
    mergeGeometries([
      new THREE.PlaneGeometry(2, 2.7).translate(-2, 1.65, 4),
      new THREE.PlaneGeometry(1.8, 3.5).rotateY(Math.PI / 2).translate(1, 2.05, 3.1),
      new THREE.PlaneGeometry(1.6, 3.5).translate(1.8, 2.05, -0.5),
    ])!,
    portalMat,
  )
  group.add(rooms, portals)

  return {
    group,
    /** f is the fractional chapter index; `at` is this site's chapter. */
    update(f: number, at: number, time: number) {
      const open = ease((f - (at - 0.5)) / 0.42) * (1 - ease((f - (at + 0.55)) / 0.3))
      hinge.rotation.x = -open * 1.25
      westWall.position.y = -ease((open - 0.2) / 0.8) * (H + 0.4)
      const dusk = ease((f - (at - 1)) / 0.6)
      lamp.intensity = dusk * (22 + open * 70) * (1 + Math.sin(time * 9) * 0.03)
      porchLamp.intensity = dusk * 30
      glow.color.setRGB(0.5 + dusk * 1.5, 0.3 + dusk * 0.8, 0.14 + dusk * 0.28)
      const helpers = ease((open - 0.45) / 0.4)
      rooms.visible = portals.visible = helpers > 0.01
      ;(rooms.material as THREE.LineBasicMaterial).opacity = helpers
      portalMat.opacity = helpers * 0.3
      sign.visible = f > 1
    },
  }
}
