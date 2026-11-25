import '@fontsource-variable/space-grotesk'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './style.css'
import { MathUtils, Vector2, Vector3 } from 'three'
import { createField, interiorRotation, spawnRotation } from './field'

type Field = Awaited<ReturnType<typeof createField>>
type Direction = 'forward' | 'left' | 'back' | 'right' | 'turnLeft' | 'turnRight'
type LookDrag = { id: number; x: number; y: number; moved: boolean }

const speed = 5.3
const directions = new Map<string, Direction>([
  ['KeyW', 'forward'], ['ArrowUp', 'forward'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'],
  ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyQ', 'turnLeft'], ['KeyE', 'turnRight'],
])
const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function startGame(game: Field) {
  const { scene, camera, renderer, start, interior, equipment, move } = game
  const canvas = renderer.domElement
  const field = document.getElementById('field')!
  const stage = document.getElementById('game-canvas')!
  const lookHint = document.getElementById('look-hint')!
  const interactionHint = document.getElementById('interaction-hint')!
  const compass = document.getElementById('compass')!
  const message = document.getElementById('field-status')!
  const restart = document.querySelector<HTMLButtonElement>('#restart')!
  const enter = document.querySelector<HTMLButtonElement>('#interior')!
  const exit = document.querySelector<HTMLButtonElement>('#exterior')!
  const fullscreen = document.querySelector<HTMLButtonElement>('#fullscreen')!
  const fullscreenLabel = document.getElementById('fullscreen-label')!
  const pressed = new Map<string, Direction>()
  const held = new Map<number, Direction>()
  const playerPosition = new Vector3()
  const movement = new Vector3()
  const screenCenter = new Vector2()
  const pointer = new Vector2()
  let pointing = false
  const touch = matchMedia('(pointer: coarse)')
  const baseFov = camera.fov
  let feedbackTimeout: number | undefined
  let drag: LookDrag | null = null
  let skipClick = false
  let dragHint = typeof canvas.requestPointerLock !== 'function'
  let previousTime: number | undefined

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  stage.append(canvas)
  restart.disabled = false
  enter.disabled = false
  exit.disabled = false
  message.hidden = true
  lookHint.hidden = false

  function placePlayer(position: Vector3, rotation: { yaw: number; pitch: number }) {
    pressed.clear()
    held.clear()
    drag = null
    skipClick = false
    pointing = false
    playerPosition.copy(position)
    camera.position.copy(playerPosition)
    camera.rotation.set(rotation.pitch, rotation.yaw, 0)
  }

  function reset() {
    placePlayer(start, spawnRotation)
  }

  function showFeedback(text: string) {
    clearTimeout(feedbackTimeout)
    message.textContent = text
    message.hidden = false
    feedbackTimeout = window.setTimeout(() => { message.hidden = true }, 2600)
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage
    if (!width || !height) return
    camera.aspect = width / height
    const portraitFov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(26)) / camera.aspect))
    camera.fov = MathUtils.clamp(portraitFov, baseFov, 110)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  if (document.fullscreenEnabled && typeof field.requestFullscreen === 'function') {
    fullscreen.hidden = false
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === field) await document.exitFullscreen()
        else await field.requestFullscreen({ navigationUI: 'hide' })
      } catch {
        showFeedback('Fullscreen is unavailable here.')
      }
    })

    document.addEventListener('fullscreenchange', () => {
      const label = document.fullscreenElement === field ? 'Exit fullscreen' : 'Fullscreen'
      fullscreenLabel.textContent = label
      fullscreen.title = label
      fullscreen.setAttribute('aria-label', label)
    })
  }

  function updateHeading() {
    const heading = headings[MathUtils.euclideanModulo(Math.round(-camera.rotation.y * 4 / Math.PI), headings.length)]
    if (compass.textContent !== heading) compass.textContent = heading
  }

  function locked() {
    return document.pointerLockElement === canvas
  }

  function updateLookHint() {
    const isLocked = locked()
    field.classList.toggle('is-locked', isLocked)
    lookHint.textContent = isLocked ? 'Esc to release mouse' : touch.matches || dragHint ? 'Drag to look around' : 'Click the field to look around'
  }

  function useDragLook() {
    dragHint = true
    updateLookHint()
  }

  function look(horizontal: number, vertical: number) {
    camera.rotation.y = MathUtils.euclideanModulo(camera.rotation.y - horizontal + Math.PI, 2 * Math.PI) - Math.PI
    camera.rotation.x = MathUtils.clamp(camera.rotation.x - vertical, -1.35, 1.35)
  }

  function pointAt(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    return pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
  }

  canvas.addEventListener('click', (event) => {
    if (skipClick) {
      skipClick = false
      return
    }

    const control = equipment.aim(camera, locked() ? screenCenter : pointAt(event))
    if (control) {
      showFeedback(control.use())
      return
    }

    if (!locked() && event.pointerType !== 'touch' && !touch.matches) {
      try {
        void canvas.requestPointerLock?.()?.catch(useDragLook)
      } catch {
        useDragLook()
      }
    }
  })
  canvas.addEventListener('pointerdown', (event) => {
    if (locked() || event.button !== 0 || drag) return
    skipClick = false
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (locked()) return
    if (drag?.id === event.pointerId) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 3) return
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved = true
      look(dx * 0.006, dy * 0.006)
      pointing = false
      return
    }
    if (event.pointerType === 'mouse') {
      pointAt(event)
      pointing = true
    }
  })
  canvas.addEventListener('pointerleave', () => { pointing = false })
  canvas.addEventListener('lostpointercapture', (event) => {
    if (drag?.id !== event.pointerId) return
    skipClick = drag.moved
    drag = null
  })
  document.addEventListener('mousemove', (event) => {
    if (locked()) look(event.movementX * 0.0025, event.movementY * 0.0025)
  })
  document.addEventListener('pointerlockchange', updateLookHint)
  document.addEventListener('pointerlockerror', useDragLook)
  touch.addEventListener('change', updateLookHint)
  restart.addEventListener('click', reset)
  enter.addEventListener('click', () => placePlayer(interior, interiorRotation))
  exit.addEventListener('click', reset)

  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.code === 'KeyF' && !event.repeat) {
      const control = equipment.aim(camera, screenCenter)
      if (control) {
        event.preventDefault()
        showFeedback(control.use())
      }
      return
    }
    const direction = directions.get(event.code)
    if (!direction) return
    event.preventDefault()
    pressed.set(event.code, direction)
  })
  window.addEventListener('keyup', (event) => pressed.delete(event.code))
  window.addEventListener('blur', () => {
    pressed.clear()
    held.clear()
    drag = null
    skipClick = false
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')) {
    const direction = directions.get(button.dataset.move ?? '')
    if (!direction) continue
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      button.setPointerCapture(event.pointerId)
      held.set(event.pointerId, direction)
    })
    button.addEventListener('lostpointercapture', (event) => held.delete(event.pointerId))
  }

  function driving(direction: Direction) {
    for (const code of pressed.values()) {
      if (code === direction) return 1
    }
    for (const code of held.values()) {
      if (code === direction) return 1
    }
    return 0
  }

  function movePlayer(delta: number) {
    const turn = driving('turnRight') - driving('turnLeft')
    if (turn) look(turn * 1.75 * delta, 0)

    const horizontal = driving('right') - driving('left')
    const vertical = driving('forward') - driving('back')
    if (!horizontal && !vertical) return

    const sin = Math.sin(camera.rotation.y)
    const cos = Math.cos(camera.rotation.y)
    movement.set(horizontal * cos - vertical * sin, 0, -horizontal * sin - vertical * cos)
    const distance = speed * delta
    const steps = Math.ceil(distance / 0.12)
    if (!steps) return

    movement.normalize().multiplyScalar(distance / steps)
    for (let step = 0; step < steps; step++) {
      const { x, z } = playerPosition
      if (movement.x) move(playerPosition, x + movement.x, z)
      if (movement.z) move(playerPosition, playerPosition.x, z + movement.z)
    }
  }

  reset()
  updateLookHint()
  resize()
  new ResizeObserver(resize).observe(stage)
  renderer.setAnimationLoop((now) => {
    const delta = Math.min((now - (previousTime ?? now)) / 1000, 0.05)
    previousTime = now
    movePlayer(delta)
    camera.position.set(playerPosition.x, MathUtils.damp(camera.position.y, playerPosition.y, 18, delta), playerPosition.z)
    equipment.update(delta)
    updateHeading()
    const centered = locked() || touch.matches
    const aimed = centered || pointing ? equipment.aim(camera, centered ? screenCenter : pointer) : undefined
    interactionHint.hidden = !aimed
    const hint = aimed ? `${aimed.label} · ${touch.matches ? 'Toca' : 'Clic o F'}` : ''
    if (interactionHint.textContent !== hint) interactionHint.textContent = hint
    canvas.style.cursor = aimed && !centered ? 'pointer' : ''
    renderer.render(scene, camera)
  })
}

try {
  startGame(await createField())
} catch (error) {
  document.getElementById('game-error')!.hidden = false
  document.getElementById('field-status')!.hidden = true
  document.getElementById('touch-controls')!.hidden = true
  console.error(error)
}
