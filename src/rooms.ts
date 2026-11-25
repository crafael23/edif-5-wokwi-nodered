// Measured from the four occupied levels and their door openings in Version 2.1.
const groundWalls = [335.66, 345.75, 355.75, 365.75, 395.75, 424.36]
const upperWalls = [335.66, 345.75, 355.75, 365.75, 375.75, 385.75, 395.75, 405.75, 415.75, 424.36]
const groundDoors = [[344.56, 345.61], [345.85, 346.9], [364.6, 365.65], [367.75, 369.9], [422.35, 423.4]]
const upperDoors = [[344.56, 345.61], [345.85, 346.9], [364.6, 365.65], [365.85, 366.9],
  [384.6, 385.65], [385.85, 386.9], [404.6, 405.65], [405.85, 406.9], [415.85, 416.9]]

export const levels = [
  { floor: 0.4, ceiling: 5.4, corridorCeiling: 5.4 },
  { floor: 5.8, ceiling: 8.8, corridorCeiling: 8.8 },
  { floor: 9.2, ceiling: 12.2, corridorCeiling: 12.2 },
  { floor: 12.6, ceiling: 16.55, corridorCeiling: 16.1 },
]

export const rooms = levels.flatMap((level, index) => {
  const walls = index ? upperWalls : groundWalls
  const doors = index ? upperDoors : groundDoors
  return doors.map(([left, right], room) => {
    const minX = walls[room] + 0.09
    const maxX = walls[room + 1] - 0.09
    const doorX = (left + right) / 2
    return {
      ...level,
      number: (index + 1) * 100 + room + 1,
      minX,
      maxX,
      minZ: -519.23,
      maxZ: -510.57,
      doorX,
      panelX: doorX < (minX + maxX) / 2 ? right + 0.48 : left - 0.48,
    }
  })
})

export type Classroom = typeof rooms[number]
