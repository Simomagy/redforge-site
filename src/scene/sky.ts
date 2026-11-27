import * as THREE from 'three'

export function createSky(starCount: number) {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() },
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uGround, uSunDir, uSunCol;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = mix(uHorizon, uTop, pow(clamp(d.y * 1.15, 0.0, 1.0), 0.55));
          col = mix(col, uGround, smoothstep(0.0, -0.08, d.y));
          float s = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.35);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  )
  dome.renderOrder = -10
  dome.frustumCulled = false

  const p = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2
    const y = 0.04 + Math.random() * 0.96
    const r = Math.sqrt(1 - y * y)
    p[i * 3] = Math.cos(a) * r * 850
    p[i * 3 + 1] = y * 850
    p[i * 3 + 2] = Math.sin(a) * r * 850
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3))
  const starMat = new THREE.PointsMaterial({
    color: '#ffe9d2',
    size: 1.8,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    fog: false,
  })
  const stars = new THREE.Points(starGeo, starMat)
  stars.renderOrder = -9
  stars.frustumCulled = false

  const group = new THREE.Group()
  group.add(dome, stars)
  return { group, uniforms, starMat }
}
