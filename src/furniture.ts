import {
  BoxGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D,
  type BufferGeometry,
} from 'three'
import { type Classroom, levels } from './rooms'

export const cube = new BoxGeometry()
const cylinder = new CylinderGeometry(1, 1, 1, 12)
const wood = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })
const steel = new MeshStandardMaterial({ color: '#2b2d30', roughness: 0.65, metalness: 0.18 })
const chairFinishes = ['#a8703d', '#c18b52', '#9e5e36', '#bc9561', '#ac7e4e']
const porcelain = new MeshStandardMaterial({ color: '#e7e8e3', roughness: 0.26 })
const fittings = new MeshStandardMaterial({ color: '#8f989b', metalness: 0.8, roughness: 0.28 })

export type Piece = {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  yaw?: number
  color?: string
}

export function box(x: number, y: number, z: number, w: number, h: number, d: number): Piece {
  return { x, y, z, w, h, d }
}

export function batch(parent: Object3D, name: string, parts: Piece[], material: MeshStandardMaterial, geometry: BufferGeometry = cube) {
  const mesh = new InstancedMesh(geometry, material, parts.length)
  const object = new Object3D()
  const color = new Color()
  parts.forEach((piece, index) => {
    object.position.set(piece.x, piece.y, piece.z)
    object.rotation.y = piece.yaw ?? 0
    object.scale.set(piece.w, piece.h, piece.d)
    object.updateMatrix()
    mesh.setMatrixAt(index, object.matrix)
    if (piece.color) mesh.setColorAt(index, color.set(piece.color))
  })
  mesh.name = name
  mesh.receiveShadow = true
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  parent.add(mesh)
  return mesh
}

const panels = [
  box(0, 0.46, 0.025, 0.43, 0.045, 0.41),
  box(0, 0.775, 0.228, 0.43, 0.245, 0.035),
  box(0.15, 0.795, -0.188, 0.43, 0.041, 0.34),
]
const chairFrame = [
  ...[-0.17, 0.17].flatMap(x => [
    box(x, 0.225, -0.143, 0.025, 0.45, 0.025),
    box(x, 0.45, 0.211, 0.024, 0.90, 0.024),
    box(x, 0.15, 0.015, 0.022, 0.022, 0.352),
  ]),
  box(0, 0.16, 0.18, 0.36, 0.025, 0.023),
  box(0.31, 0.6, -0.21, 0.023, 0.38, 0.021),
]
const boardWhite = new MeshStandardMaterial({ color: '#edf1f3', roughness: 0.5 })

export function furnishClassroom(parent: Object3D, room: Classroom) {
  const tops: Piece[] = []
  const frames: Piece[] = []
  const rows = Math.min(14, Math.floor((room.maxX - room.minX - 3.2) / 1.52))
  const columns = [-518.15, -517.07, -515.99, -514.2, -513.12, -512.04]
  for (let row = 0; row < rows; row++) {
    for (const [column, z] of columns.entries()) {
      const x = room.minX + 2.65 + row * 1.52
      const color = chairFinishes[(row + column * 3 + room.number) % chairFinishes.length]
      for (const part of panels) {
        tops.push({ ...part, x: x + part.z, y: room.floor + part.y, z: z - part.x, yaw: Math.PI / 2, color })
      }
      for (const part of chairFrame) {
        frames.push({ ...part, x: x + part.z, y: room.floor + part.y, z: z - part.x, yaw: Math.PI / 2 })
      }
    }
  }

  const centerZ = (room.minZ + room.maxZ) / 2
  const deskX = room.minX + 1.1
  const deskZ = centerZ - 1.75
  tops.push({ ...box(deskX, room.floor + 0.77, deskZ, 0.66, 0.055, 1.35), color: '#9d6b3d' })
  for (const dx of [-0.26, 0.26]) for (const dz of [-0.57, 0.57]) {
    frames.push(box(deskX + dx, room.floor + 0.37, deskZ + dz, 0.04, 0.74, 0.04))
  }
  frames.push(box(room.minX + 0.097, room.floor + 1.7, centerZ, 0.06, 1.23, 3.68))

  batch(parent, 'Pupitres de madera', tops, wood)
  batch(parent, 'Estructuras de pupitres', frames, steel)
  batch(parent, 'Pizarra', [box(room.minX + 0.132, room.floor + 1.7, centerZ, 0.018, 1.17, 3.61)], boardWhite)
}

export function furnishBathrooms(parent: Object3D) {
  const ceramic: Piece[] = []
  const metal: Piece[] = []
  const bowls: Piece[] = []
  const seats: Piece[] = []
  const partitions: Piece[] = []
  const dividers = new MeshStandardMaterial({ color: '#929997', roughness: 0.7 })
  for (const { floor } of levels) {
    for (const [wallX, side, frontZ, toiletX, stallZ] of [
      [345.26, 1, -504.55, 346.84, -501.05],
      [411.52, -1, -504.7, 409.95, -501.20],
    ]) {
      for (let sink = 0; sink < 3; sink++) {
        const z = frontZ + sink * 0.9
        const x = wallX + side * 0.25
        ceramic.push(box(x, floor + 1.06, z, 0.48, 0.09, 0.51))
        ceramic.push(box(x + side * 0.208, floor + 1.123, z, 0.07, 0.048, 0.51))
        for (const rim of [-0.223, 0.223]) ceramic.push(box(x, floor + 1.123, z + rim, 0.43, 0.05, 0.064))
        metal.push(box(x - side * 0.17, floor + 1.18, z, 0.025, 0.16, 0.032))
        metal.push(box(x - side * 0.111, floor + 1.252, z, 0.145, 0.025, 0.029))
        metal.push(box(x, floor + 1.107, z, 0.08, 0.005, 0.08))
      }
      const wallBottom = floor + 0.28
      partitions.push(box(wallX + side * 0.035, wallBottom + 0.76, frontZ + 0.9, 0.018, 1.52, 2.72))
      for (let i = 0; i < 2; i++) {
        const z = stallZ - 0.26 + 2.15 * i
        ceramic.push(box(toiletX, floor + 0.72, z + 0.36, 0.42, 0.55, 0.16))
        bowls.push(box(toiletX, floor + 0.47, z + 0.04, 0.20, 0.36, 0.265))
        seats.push(box(toiletX, floor + 0.651, z + 0.04, 0.145, 0.014, 0.18))
      }
    }
  }
  batch(parent, 'Lavabos y cisternas', ceramic, porcelain)
  batch(parent, 'Grifería', metal, fittings)
  batch(parent, 'Tazas sanitarias', bowls, porcelain, cylinder)
  batch(parent, 'Asientos sanitarios', seats, dividers, cylinder)
  batch(parent, 'Revestimiento de baños', partitions, porcelain)
}

export function furnishCorridors(parent: Object3D) {
  const seats: Piece[] = []
  const frames: Piece[] = []
  const blue = new MeshStandardMaterial({ color: '#234d86', roughness: 0.48 })
  for (const { floor } of levels) for (const x of [363.3, 416.3]) {
    const z = -505.88
    seats.push(box(x, floor + 0.48, z, 1.86, 0.055, 0.415))
    for (const offset of [-0.73, 0.73]) {
      frames.push(box(x + offset, floor + 0.23, z, 0.045, 0.46, 0.34))
    }
  }
  batch(parent, 'Bancas azules del pasillo', seats, blue)
  batch(parent, 'Patas de las bancas', frames, steel)
}
