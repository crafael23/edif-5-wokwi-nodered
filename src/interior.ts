import {
  BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  Raycaster, Scene, SRGBColorSpace, Vector2,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { MeshBVH } from 'three-mesh-bvh'
import { batch, box, cube, furnishBathrooms, furnishClassroom, furnishCorridors, type Piece } from './furniture'
import { levels, rooms, type Classroom } from './rooms'
import { applyBuildingLighting, classroomLamp, corridorLamp, corridorSwitchXs } from './building-lighting'

type Control = { label: string; use: () => string }
type RegisterControl = (parent: Group, x: number, y: number, z: number, width: number, height: number, control: Control) => void
type Fan = { rotor: Mesh; setting: number }
type ClassroomState = {
  room: Classroom
  tubes: MeshStandardMaterial
  fans: Fan[]
}

const housing = new MeshStandardMaterial({ color: '#bfc3c2', roughness: 0.65 })
const fluorescent = new MeshStandardMaterial({ color: '#ebf3ff', emissive: '#def0ff', emissiveIntensity: 4.8 })
const fanPaint = new MeshStandardMaterial({ color: '#d9d5ca', roughness: 0.74 })
const switchPlate = new MeshStandardMaterial({ color: '#d3cdbd', roughness: 0.8 })
const dialPaint = new MeshStandardMaterial({ color: '#343638', roughness: 0.63 })
const markerPaint = new MeshStandardMaterial({ color: '#f1ede3', roughness: 0.65 })
const hitMaterial = new MeshBasicMaterial({ visible: false })
const cylinder = new CylinderGeometry(1, 1, 1, 12)
const motor = new CylinderGeometry(0.125, 0.092, 0.1, 16)
const fanGeometry = mergeGeometries([
  motor,
  ...[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map(angle =>
    new BoxGeometry(0.53, 0.023, 0.145).translate(0.375, 0, 0.022).rotateY(angle)),
])
const fanRates = [0, 4.4, 8.7, 14]
const fanSpeeds = ['apagado', 'lenta', 'media', 'rápida']
const controlReach = 2.4

function piece(parent: Group, shape: Piece, material: MeshStandardMaterial, geometry: BufferGeometry = cube) {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(shape.x, shape.y, shape.z)
  mesh.scale.set(shape.w, shape.h, shape.d)
  parent.add(mesh)
  return mesh
}

function addText(parent: Group, text: string | ReadonlyArray<readonly [string, number]>, x: number, y: number, z: number, width: number, height: number) {
  const panel = typeof text !== 'string'
  const canvas = document.createElement('canvas')
  canvas.width = panel ? 512 : 256
  canvas.height = panel ? 64 : 96
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = panel ? '#d3cdbd' : '#203554'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = panel ? '#343638' : '#e7be69'
  context.font = panel ? 'bold 28px sans-serif' : 'bold 65px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  if (typeof text === 'string') context.fillText(text, canvas.width / 2, canvas.height / 2)
  else for (const [label, offset] of text) {
    context.fillText(label, canvas.width * (0.5 - offset / width), canvas.height / 2)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  const label = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map }))
  label.position.set(x, y, z)
  if (panel) label.rotation.y = Math.PI
  parent.add(label)
}

function mountFixtures(parent: Group, room: Classroom, bulbs: MeshStandardMaterial) {
  const width = room.maxX - room.minX
  const base: Piece[] = []
  const tubes: Piece[] = []
  for (const x of classroomLamp.columns) {
    for (const z of classroomLamp.rows) {
      const at = room.minX + width * x
      base.push(box(at, room.ceiling - 0.038, z, 1.15, 0.076, 0.184))
      tubes.push(box(at, room.ceiling - 0.10, z, 1.06, 0.044, 0.114))
    }
  }
  batch(parent, 'Seis luminarias', base, housing)
  batch(parent, 'Tubos del aula', tubes, bulbs)

  const mounts: Piece[] = []
  const drop = room.ceiling - room.floor > 4 ? 0.57 : 0.27
  const fans = [0.34, 0.66].flatMap(fraction => [-516.65, -513.35].map(z => {
    const x = room.minX + width * fraction
    mounts.push(box(x, room.ceiling - 0.035, z, 0.109, 0.07, 0.109))
    mounts.push(box(x, room.ceiling - 0.06 - drop / 2, z, 0.024, drop, 0.024))
    const rotor = new Mesh(fanGeometry, fanPaint)
    rotor.name = 'Ventilador de techo'
    rotor.position.set(x, room.ceiling - drop - 0.10, z)
    rotor.rotation.y = fraction * 2 + z
    parent.add(rotor)
    return { rotor, setting: 0 }
  }))
  batch(parent, 'Soportes de ventiladores', mounts, fanPaint, cylinder)
  return fans
}

function fitControls(parent: Group, state: ClassroomState, switches: Float32Array, index: number, register: (x: number, y: number, z: number, width: number, height: number, control: Control) => void) {
  const { room, fans } = state
  const x = room.panelX
  const y = room.floor + 1.38
  const z = room.maxZ - 0.055
  piece(parent, box(x, y, z, 0.58, 0.238, 0.041), switchPlate)
  const dialOffsets = [-0.103, 0.002, 0.107, 0.212]
  const labels = [['LUZ', -0.215] as const, ...dialOffsets.map((offset, i) => [String(i + 1), offset] as const)]
  addText(parent, labels, x, y + 0.068, z - 0.023, 0.545, 0.065)
  addText(parent, String(room.number), x, room.floor + 2.03, -510.414 + 0.021, 0.26, 0.10)
  const rockerX = x - 0.215
  const rocker = piece(parent, box(rockerX, y - 0.025, z - 0.043, 0.062, 0.09, 0.035), markerPaint)
  rocker.rotation.x = -0.24
  register(rockerX, y - 0.012, z - 0.071, 0.095, 0.16, {
    label: 'Interruptor del aula',
    use() {
      const on = switches[index] === 0
      switches[index] = on ? 1 : 0
      state.tubes.emissiveIntensity = on ? 4.8 : 0
      state.tubes.color.set(on ? '#ebf3ff' : '#788288')
      rocker.rotation.x = on ? -0.24 : 0.24
      return `Aula ${room.number} · luces ${on ? 'encendidas' : 'apagadas'}`
    },
  })

  fans.forEach((fan, i) => {
    const cx = x + dialOffsets[i]
    const cy = y - 0.027
    const knob = new Group()
    knob.position.set(cx, cy, z - 0.033)
    parent.add(knob)
    piece(knob, box(0, 0, -0.013, 0.031, 0.029, 0.031), dialPaint, cylinder).rotation.x = Math.PI / 2
    piece(knob, box(0, 0.014, -0.030, 0.005, 0.021, 0.005), markerPaint)
    knob.rotation.z = -2.1
    register(cx, cy, z - 0.079, 0.097, 0.117, {
      label: `Potenciómetro del ventilador ${i + 1}`,
      use() {
        fan.setting = (fan.setting + 1) % fanRates.length
        knob.rotation.z = -2.1 + fan.setting * 1.4
        const speed = fanSpeeds[fan.setting]
        return `Aula ${room.number} · ventilador ${i + 1} ${fan.setting ? `en velocidad ${speed}` : speed}`
      },
    })
  })
}

function lightCorridors(parent: Group, register: RegisterControl, switches: Float32Array) {
  const { firstX, spacing, perSwitch, z: corridorZ } = corridorLamp
  levels.forEach(({ floor, corridorCeiling }, level) => corridorSwitchXs.forEach((switchX, index) => {
    const group = new Group()
    group.name = `Pasillo del nivel ${level + 1} · sector ${index + 1}`
    parent.add(group)
    const positions = Array.from({ length: perSwitch }, (_, offset) => firstX + (index * perSwitch + offset) * spacing)
    const emitter = fluorescent.clone()
    batch(group, 'Soportes de luces del pasillo', positions.map(x => box(x, corridorCeiling - 0.038, corridorZ, 0.19, 0.076, 1.11)), housing)
    batch(group, 'Tres luces del pasillo', positions.map(x => box(x, corridorCeiling - 0.093, corridorZ, 0.12, 0.045, 1.02)), emitter)

    const circuit = level * corridorSwitchXs.length + index
    const y = floor + 1.38
    const z = -510.345
    piece(group, box(switchX, y, z, 0.13, 0.19, 0.04), switchPlate)
    const rocker = piece(group, box(switchX, y - 0.005, z + 0.033, 0.06, 0.082, 0.028), markerPaint)
    rocker.rotation.x = -0.24
    addText(group, String(index + 1), switchX, y + 0.16, z + 0.023, 0.15, 0.073)
    register(group, switchX, y, z + 0.053, 0.14, 0.19, {
      label: `Interruptor del pasillo ${index + 1}`,
      use() {
        const on = switches[circuit] === 0
        switches[circuit] = on ? 1 : 0
        emitter.emissiveIntensity = on ? 4.8 : 0
        emitter.color.set(on ? '#ebf3ff' : '#788288')
        rocker.rotation.x = on ? -0.24 : 0.24
        return `Pasillo · nivel ${level + 1}, sector ${index + 1} · luces ${on ? 'encendidas' : 'apagadas'}`
      },
    })
  }))
}

function lightBathrooms(parent: Group) {
  const base: Piece[] = []
  const tubes: Piece[] = []
  for (const { ceiling } of levels) {
    for (const x of [347.2, 410.5]) {
      base.push(box(x, ceiling - 0.50, -503.84, 0.18, 0.065, 0.98))
      tubes.push(box(x, ceiling - 0.55, -503.84, 0.12, 0.034, 0.93))
    }
  }
  batch(parent, 'Soportes de luces de los baños', base, housing)
  batch(parent, 'Luces de los baños', tubes, fluorescent)
}

export function populateInterior(scene: Scene, building: MeshBVH, model: Object3D) {
  const furnishings = new Group()
  furnishings.name = 'Mobiliario interior'
  scene.add(furnishings)
  const targets: Mesh[] = []
  const controls = new Map<Mesh, Control>()
  const controlBox = new BoxGeometry()
  const raycaster = new Raycaster()
  raycaster.far = controlReach

  const register: RegisterControl = (parent, x, y, z, width, height, control) => {
    const target = new Mesh(controlBox, hitMaterial)
    target.name = control.label
    target.position.set(x, y, z)
    target.scale.set(width, height, 0.017)
    parent.add(target)
    targets.push(target)
    controls.set(target, control)
  }

  const classroomSwitches = new Float32Array(rooms.length).fill(1)
  const classrooms = rooms.map((room, index) => {
    const classroom = new Group()
    classroom.name = `Aula ${room.number}`
    furnishings.add(classroom)
    const tubes = fluorescent.clone()
    const state = { room, tubes, fans: mountFixtures(classroom, room, tubes) }
    furnishClassroom(classroom, room)
    fitControls(classroom, state, classroomSwitches, index, (x, y, z, width, height, control) => {
      register(classroom, x, y, z, width, height, control)
    })
    return state
  })

  const corridorSwitches = new Float32Array(levels.length * corridorSwitchXs.length).fill(1)
  lightCorridors(furnishings, register, corridorSwitches)
  lightBathrooms(furnishings)
  furnishCorridors(furnishings)
  furnishBathrooms(furnishings)
  applyBuildingLighting(model, furnishings, corridorSwitches, classroomSwitches)
  furnishings.updateMatrixWorld(true)

  function update(delta: number) {
    for (const room of classrooms) {
      for (const fan of room.fans) {
        if (fan.setting) fan.rotor.rotation.y = (fan.rotor.rotation.y + delta * fanRates[fan.setting]) % (Math.PI * 2)
      }
    }
  }

  function aim(camera: PerspectiveCamera, coordinate: Vector2) {
    camera.updateMatrixWorld()
    raycaster.setFromCamera(coordinate, camera)
    const [hit] = raycaster.intersectObjects(targets, false)
    if (!hit || building.raycastFirst(raycaster.ray, DoubleSide, 0.01, hit.distance - 0.01)) return
    return controls.get(hit.object as Mesh)
  }

  return { update, aim }
}
