import {
  Box3, DirectionalLight, DoubleSide, HemisphereLight, Mesh, MeshStandardMaterial,
  PlaneGeometry, RepeatWrapping, Scene, SpotLight, SRGBColorSpace, Texture, Vector3,
  type Object3D,
} from 'three'

const treePlacements = [
  { x: 438.8, z: -504.4, height: 11.8, angle: 0.55 },
  { x: 417, z: -481.9, height: 10.6, angle: 1.32 },
  { x: 389.2, z: -480.4, height: 12.5, angle: 0.38 },
  { x: 367.9, z: -484.6, height: 8.7, angle: 1.08 },
  { x: 329.7, z: -500.2, height: 9.8, angle: 0.64 },
  { x: 350.6, z: -534.6, height: 10, angle: 0.35 },
  { x: 380.4, z: -532.6, height: 10.2, angle: 1.44 },
  { x: 410.5, z: -534.4, height: 10.8, angle: 0.86 },
]

export function clearsTreeTrunks(x: number, z: number, playerRadius: number) {
  return treePlacements.every(tree => Math.hypot(tree.x - x, tree.z - z) >= tree.height * 0.053 + playerRadius)
}

export function lightSite(scene: Scene, model: Object3D, bounds: Box3, anisotropy: number, groundY: number) {
  let gravel: Texture | undefined
  const filteredMaps = new Set<Texture>()
  model.traverse(object => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
    const material = object.material
    object.receiveShadow = true
    object.castShadow = !material.transparent
    material.shadowSide = DoubleSide
    if (material.map && !filteredMaps.has(material.map)) {
      material.map.anisotropy = anisotropy
      filteredMaps.add(material.map)
    }
    if (material.name === 'Grava de la explanada' && material.map) gravel = material.map
  })

  scene.add(new HemisphereLight('#9fbdeb', '#5c6070', 0.88))
  const moon = new DirectionalLight('#a9c8ff', 0.55)
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  moon.target.position.set(center.x, 0, center.z)
  moon.position.copy(moon.target.position).add(new Vector3(-56, 72, 48))
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  const shadowSpan = Math.max(size.x, size.z) * 0.58
  Object.assign(moon.shadow.camera, {
    left: -shadowSpan, right: shadowSpan, bottom: -shadowSpan, top: shadowSpan, near: 10, far: 185,
  })
  moon.shadow.camera.updateProjectionMatrix()
  moon.shadow.normalBias = 0.055
  moon.shadow.bias = -0.00018
  moon.shadow.radius = 2
  scene.add(moon, moon.target)

  for (const x of [347.3, 379.8, 421.4]) {
    const entrance = new SpotLight('#ffdda9', 108, 18, 0.87, 0.67, 2)
    entrance.position.set(x, 4.8, -505.7)
    entrance.target.position.set(x, 0, -502.1)
    scene.add(entrance, entrance.target)
  }

  const width = size.x + 520
  const depth = size.z + 520
  const groundTexture = gravel?.clone()
  if (groundTexture) {
    groundTexture.wrapS = groundTexture.wrapT = RepeatWrapping
    groundTexture.repeat.set(width / 2.4, depth / 2.4)
    groundTexture.needsUpdate = true
  }
  const ground = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshStandardMaterial({ color: groundTexture ? '#c1b9a4' : '#9b988e', map: groundTexture ?? null, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(center.x, groundY, center.z)
  ground.receiveShadow = true
  scene.add(ground)
}

export function plantShadeTrees(scene: Scene, texture: Texture, groundAt: (x: number, z: number) => number) {
  texture.colorSpace = SRGBColorSpace
  const image = texture.image
  if (!(image instanceof HTMLImageElement)) throw new Error('Expected an image texture for the shade trees')
  const aspect = image.naturalWidth / image.naturalHeight
  const geometry = new PlaneGeometry(aspect, 1)
  geometry.translate(aspect * 0.033, 0.5, 0)
  const material = new MeshStandardMaterial({
    map: texture, alphaTest: 0.35, alphaToCoverage: true, side: DoubleSide, roughness: 1,
  })
  for (const tree of treePlacements) {
    const ground = groundAt(tree.x, tree.z)
    for (const angle of [tree.angle, tree.angle + Math.PI / 2]) {
      const canopy = new Mesh(geometry, material)
      canopy.position.set(tree.x, ground, tree.z)
      canopy.rotation.y = angle
      canopy.scale.set(tree.height, tree.height, 1)
      canopy.castShadow = true
      scene.add(canopy)
    }
  }
}
