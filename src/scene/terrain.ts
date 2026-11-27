import * as THREE from 'three'

/** Flat clearings the terrain is levelled around, so props sit on even ground. */
export const SITES = {
  forge: { x: 0, z: 0, y: 0, r: 16 },
  town: { x: 40, z: -255, y: 4, r: 24 },
  fence: { x: 130, z: -305, y: 3, r: 20 },
  partner: { x: -60, z: -74, y: 0.5, r: 17 },
} as const

/** The straight, level strip the roadmap's railway runs on, from a to b. */
export const ROAD = { ax: -168, az: -196, bx: -96, bz: -118, y: 0.6, r: 9 }

export const TERRAIN_CENTER = { x: 30, z: -100 }
export const TERRAIN_SIZE = 1000

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

export function fbm(x: number, y: number, octaves: number) {
  let amp = 0.5
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x, y) * amp
    norm += amp
    x = x * 2.03 + 17.3
    y = y * 2.03 - 9.1
    amp *= 0.5
  }
  return sum / norm
}

/** Height of the ground at a world position: rolling plains with mesas. */
export function heightAt(x: number, z: number) {
  const rolling = Math.max(0, fbm(x * 0.006 + 3.1, z * 0.006 - 1.7, 4) - 0.3) * 24
  const m = fbm(x * 0.0045 - 8.2, z * 0.0045 + 4.4, 3)
  const mesa = smoothstep(0.55, 0.61, m)
  const cap = 20 + Math.floor(fbm(x * 0.012, z * 0.012, 2) * 3) * 5
  let h = rolling + mesa * cap + (vnoise(x * 0.06, z * 0.06) - 0.5) * 1.1
  for (const s of Object.values(SITES)) {
    const d = Math.hypot(x - s.x, z - s.z)
    const w = 1 - smoothstep(s.r, s.r * 2.4, d)
    h = h + (s.y - h) * w
  }
  {
    const dx = ROAD.bx - ROAD.ax
    const dz = ROAD.bz - ROAD.az
    const t = Math.min(1, Math.max(0, ((x - ROAD.ax) * dx + (z - ROAD.az) * dz) / (dx * dx + dz * dz)))
    const d = Math.hypot(x - ROAD.ax - dx * t, z - ROAD.az - dz * t)
    h = h + (ROAD.y - h) * (1 - smoothstep(ROAD.r, ROAD.r * 2.4, d))
  }
  return h
}

export type TerrainUniforms = {
  uSunDir: { value: THREE.Vector3 }
  uSunCol: { value: THREE.Color }
  uAmbCol: { value: THREE.Color }
  uFogCol: { value: THREE.Color }
  uFogNear: { value: number }
  uFogFar: { value: number }
  uReveal: { value: number }
  uGrid: { value: number }
  uForge: { value: number }
  uModeCenter: { value: THREE.Vector3 }
  uModeRadius: { value: number }
  uClay: { value: THREE.Color }
  uCliff: { value: THREE.Color }
  uTop: { value: THREE.Color }
}

export function createTerrain(segments: number) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments)
  geo.rotateX(-Math.PI / 2)
  geo.translate(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
  }
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo.computeBoundingSphere()

  const uniforms: TerrainUniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() },
    uAmbCol: { value: new THREE.Color() },
    uFogCol: { value: new THREE.Color() },
    uFogNear: { value: 60 },
    uFogFar: { value: 420 },
    uReveal: { value: 0 },
    uGrid: { value: 0 },
    uForge: { value: 0 },
    uModeCenter: { value: new THREE.Vector3() },
    uModeRadius: { value: 0 },
    uClay: { value: new THREE.Color('#b0703f') },
    uCliff: { value: new THREE.Color('#8a3a20') },
    uTop: { value: new THREE.Color('#d39a5e') },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uModeCenter, uClay, uCliff, uTop;
      uniform float uFogNear, uFogFar, uReveal, uGrid, uForge, uModeRadius;
      varying vec3 vW;

      void main() {
        // The world is forged outwards from the anvil: nothing exists past the ember front.
        float ang = atan(vW.z, vW.x);
        float r = length(vW.xz) + sin(ang * 7.0) * 5.0 + sin(ang * 19.0 + 1.3) * 2.5;
        if (r > uReveal) discard;

        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        if (n.y < 0.0) n = -n;
        float slope = 1.0 - n.y;
        float steep = smoothstep(0.22, 0.55, slope);

        vec3 col = mix(uClay, uTop, smoothstep(12.0, 21.0, vW.y));
        col = mix(col, uCliff, steep);
        col *= 1.0 - 0.16 * step(0.5, fract(vW.y * 0.32)) * steep;

        float diff = max(dot(n, uSunDir), 0.0);
        vec3 lit = col * (uAmbCol + uSunCol * diff);

        // Forge light on the ground around the anvil.
        float fd = distance(vW, vec3(0.0, 2.2, 0.0));
        lit += col * vec3(1.0, 0.42, 0.12) * uForge / (1.0 + fd * fd * 0.22);

        // Physics mode: collisions coloured by material, around a point.
        float md = distance(vW, uModeCenter);
        float inMode = 1.0 - smoothstep(uModeRadius - 3.0, uModeRadius, md);
        vec3 phys = mix(vec3(0.20, 0.72, 0.36), vec3(0.16, 0.62, 0.86), smoothstep(12.0, 16.0, vW.y));
        phys = mix(phys, vec3(0.86, 0.22, 0.62), steep);
        phys *= 0.5 + 0.5 * diff;
        lit = mix(lit, phys, inMode * 0.93 * step(0.001, uModeRadius));
        float ring = smoothstep(uModeRadius - 3.0, uModeRadius - 1.0, md) * (1.0 - smoothstep(uModeRadius - 1.0, uModeRadius, md));
        lit += vec3(1.0, 0.75, 0.35) * ring * step(0.001, uModeRadius);

        // Editor grid.
        float camD = distance(vW, cameraPosition);
        vec2 gp = vW.xz / 10.0;
        vec2 g = abs(fract(gp - 0.5) - 0.5) / fwidth(gp);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        lit += vec3(1.0, 0.62, 0.3) * line * uGrid * (1.0 - smoothstep(40.0, 200.0, camD));

        float fog = smoothstep(uFogNear, uFogFar, camD);
        lit = mix(lit, uFogCol, fog);

        float edgeW = clamp(uReveal * 0.12, 3.0, 24.0);
        float edge = smoothstep(uReveal - edgeW, uReveal, r);
        lit = mix(lit, vec3(2.4, 0.6, 0.1), edge * edge * edge);

        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  return { mesh, uniforms }
}

/** Makes a built-in material obey the same ember front as the terrain. */
export function revealable<T extends THREE.Material>(mat: T, uReveal: { value: number }): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = uReveal
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRevealW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 revealW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          revealW = instanceMatrix * revealW;
        #endif
        vRevealW = (modelMatrix * revealW).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRevealW;\nuniform float uReveal;')
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (length(vRevealW.xz) > uReveal - 12.0) discard;',
      )
  }
  return mat
}
