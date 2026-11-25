import {
  ACESFilmicToneMapping, Box3, Color, DoubleSide, Fog, Line3,
  PerspectiveCamera, Ray, Scene, TextureLoader, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'
import { clearsTreeTrunks, lightSite, plantShadeTrees } from './site'
import { populateInterior } from './interior'

const mapUrl = new URL('./assets/version-2-1.glb', import.meta.url).href
const treeUrl = new URL('./assets/arbol-sombra.webp', import.meta.url).href
const eyeHeight = 1.65
const radius = 0.24
const stepUp = 0.51
const stepDown = 0.55
const baseHeight = -0.09

// Coordinates are in metres in the exported model, with Y up.
const spawn = new Vector3(438.5, eyeHeight, -487.3)
const room = new Vector3(422.65, eyeHeight + 0.4, -514.1)
export const spawnRotation = { yaw: 0.94, pitch: 0.23 }
export const interiorRotation = { yaw: 1.15, pitch: 0 }

export async function createField() {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.domElement.setAttribute('aria-hidden', 'true')

  try {
    const [{ scene: model }, tree] = await Promise.all([
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(mapUrl),
      new TextureLoader().loadAsync(treeUrl),
    ])
    const scene = new Scene()
    const nightSky = '#101a2c'
    scene.background = new Color(nightSky)
    scene.fog = new Fog(nightSky, 100, 255)
    const camera = new PerspectiveCamera(59, 1, 0.08, 280)
    camera.rotation.order = 'YXZ'

    scene.add(model)
    const bounds = new Box3().setFromObject(model)
    bounds.expandByScalar(4)
    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
    lightSite(scene, model, bounds, anisotropy, baseHeight)

    const generator = new StaticGeometryGenerator(model)
    generator.attributes = ['position']
    generator.useGroups = false
    const mesh = new MeshBVH(generator.generate())
    const collision = createWalkableSpace(mesh, bounds)
    const equipment = populateInterior(scene, mesh, model)
    const groundRay = new Ray(new Vector3(), new Vector3(0, -1, 0))
    plantShadeTrees(scene, tree, (x, z) => {
      groundRay.origin.set(x, 2, z)
      return mesh.raycastFirst(groundRay, DoubleSide, 0, 3)?.point.y ?? baseHeight
    })
    const start = spawn.clone()
    const interior = room.clone()
    collision.move(start, start.x, start.z)
    collision.move(interior, interior.x, interior.z)
    return { scene, camera, renderer, start, interior, equipment, move: collision.move }
  } catch (error) {
    renderer.dispose()
    throw error
  }
}

function createWalkableSpace(mesh: MeshBVH, bounds: Box3) {
  const groundRay = new Ray(new Vector3(), new Vector3(0, -1, 0))
  const body = new Line3()
  const playerBounds = new Box3()
  const onSurface = new Vector3()
  const onBody = new Vector3()

  function move(position: Vector3, x: number, z: number) {
    if (x < bounds.min.x + radius || x > bounds.max.x - radius) return
    if (z < bounds.min.z + radius || z > bounds.max.z - radius) return
    if (!clearsTreeTrunks(x, z, radius)) return

    const floor = position.y - eyeHeight
    groundRay.origin.set(x, floor + stepUp, z)
    const hit = mesh.raycastFirst(groundRay, DoubleSide, 0, stepUp + stepDown)
    if (hit?.face && Math.abs(hit.face.normal.y) < 0.62) return

    const nextFloor = hit?.point.y ?? baseHeight
    if (floor - nextFloor > stepDown || nextFloor - floor > stepUp) return

    body.start.set(x, nextFloor + stepUp + radius, z)
    body.end.set(x, nextFloor + eyeHeight, z)
    playerBounds.min.copy(body.start).addScalar(-radius)
    playerBounds.max.copy(body.end).addScalar(radius)
    const blocked = mesh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(playerBounds),
      intersectsTriangle: (triangle) => triangle.closestPointToSegment(body, onSurface, onBody) < radius,
    })
    if (!blocked) position.set(x, nextFloor + eyeHeight, z)
  }

  return { move }
}
