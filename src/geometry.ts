import { STATE_RADIUS, type StateNode, type Transition } from './model'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TransitionGeometry {
  id: string
  isLoop: boolean
  path: string
  labelX: number
  labelY: number
  labelWidth: number
  bbox: Bounds
}

const LOOP_HEIGHT = 84
const LOOP_WIDTH = 58

function createEmptyBounds(): Bounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }
}

function expandBounds(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function estimateLabelWidth(text: string): number {
  return Math.max(48, text.length * 9 + 18)
}

function createLoopGeometry(state: StateNode, labelText: string, id: string): TransitionGeometry {
  const leftX = state.x - STATE_RADIUS * 0.7
  const rightX = state.x + STATE_RADIUS * 0.7
  const topY = state.y - STATE_RADIUS - LOOP_HEIGHT
  const shoulderY = state.y - STATE_RADIUS - 10
  const labelWidth = estimateLabelWidth(labelText)
  const bbox = createEmptyBounds()

  expandBounds(bbox, leftX, shoulderY)
  expandBounds(bbox, state.x - LOOP_WIDTH, topY)
  expandBounds(bbox, state.x + LOOP_WIDTH, topY)
  expandBounds(bbox, rightX, shoulderY)
  expandBounds(bbox, state.x - labelWidth / 2, topY - 32)
  expandBounds(bbox, state.x + labelWidth / 2, topY)

  return {
    id,
    isLoop: true,
    path: `M ${leftX} ${shoulderY} C ${state.x - LOOP_WIDTH} ${topY}, ${state.x + LOOP_WIDTH} ${topY}, ${rightX} ${shoulderY}`,
    labelX: state.x,
    labelY: topY - 12,
    labelWidth,
    bbox,
  }
}

function createEdgeGeometry(
  transition: Transition,
  source: StateNode,
  target: StateNode,
  offset: number,
  labelText: string,
): TransitionGeometry {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy) || 1
  const ux = dx / distance
  const uy = dy / distance
  const px = -uy
  const py = ux
  const labelWidth = estimateLabelWidth(labelText)
  const bbox = createEmptyBounds()

  if (Math.abs(offset) < 1) {
    const startX = source.x + ux * STATE_RADIUS
    const startY = source.y + uy * STATE_RADIUS
    const endX = target.x - ux * STATE_RADIUS
    const endY = target.y - uy * STATE_RADIUS
    const labelX = (startX + endX) / 2
    const labelY = (startY + endY) / 2 - 12

    expandBounds(bbox, startX, startY)
    expandBounds(bbox, endX, endY)
    expandBounds(bbox, labelX - labelWidth / 2, labelY - 14)
    expandBounds(bbox, labelX + labelWidth / 2, labelY + 10)

    return {
      id: transition.id,
      isLoop: false,
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      labelX,
      labelY,
      labelWidth,
      bbox,
    }
  }

  const midX = (source.x + target.x) / 2 + px * offset
  const midY = (source.y + target.y) / 2 + py * offset
  const startVectorX = midX - source.x
  const startVectorY = midY - source.y
  const endVectorX = midX - target.x
  const endVectorY = midY - target.y
  const startLength = Math.hypot(startVectorX, startVectorY) || 1
  const endLength = Math.hypot(endVectorX, endVectorY) || 1
  const startX = source.x + (startVectorX / startLength) * STATE_RADIUS
  const startY = source.y + (startVectorY / startLength) * STATE_RADIUS
  const endX = target.x + (endVectorX / endLength) * STATE_RADIUS
  const endY = target.y + (endVectorY / endLength) * STATE_RADIUS
  const labelX = 0.25 * startX + 0.5 * midX + 0.25 * endX
  const labelY = 0.25 * startY + 0.5 * midY + 0.25 * endY - 10

  expandBounds(bbox, startX, startY)
  expandBounds(bbox, midX, midY)
  expandBounds(bbox, endX, endY)
  expandBounds(bbox, labelX - labelWidth / 2, labelY - 14)
  expandBounds(bbox, labelX + labelWidth / 2, labelY + 10)

  return {
    id: transition.id,
    isLoop: false,
    path: `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`,
    labelX,
    labelY,
    labelWidth,
    bbox,
  }
}

export function buildTransitionGeometries(
  states: StateNode[],
  transitions: Transition[],
  labelForTransition: (transition: Transition) => string,
): Map<string, TransitionGeometry> {
  const geometries = new Map<string, TransitionGeometry>()
  const stateById = new Map(states.map((state) => [state.id, state]))
  const directionalGroups = new Map<string, Transition[]>()

  for (const transition of transitions) {
    if (transition.fromId === transition.toId) {
      continue
    }

    const key = `${transition.fromId}->${transition.toId}`
    const group = directionalGroups.get(key)

    if (group) {
      group.push(transition)
    } else {
      directionalGroups.set(key, [transition])
    }
  }

  for (const transition of transitions) {
    const source = stateById.get(transition.fromId)
    const target = stateById.get(transition.toId)

    if (!source || !target) {
      continue
    }

    const labelText = labelForTransition(transition)

    if (transition.fromId === transition.toId) {
      geometries.set(transition.id, createLoopGeometry(source, labelText, transition.id))
      continue
    }

    const key = `${transition.fromId}->${transition.toId}`
    const reverseKey = `${transition.toId}->${transition.fromId}`
    const sameDirection = directionalGroups.get(key) ?? []
    const reverseDirection = directionalGroups.get(reverseKey) ?? []
    const sameIndex = sameDirection.findIndex(({ id }) => id === transition.id)
    const centeredIndex = sameIndex - (sameDirection.length - 1) / 2

    let offset = 0

    if (reverseDirection.length > 0) {
      const [firstId] = [transition.fromId, transition.toId].sort()
      const directionSign = transition.fromId === firstId ? 1 : -1
      offset = directionSign * 56 + centeredIndex * 22 * directionSign
    } else if (sameDirection.length > 1) {
      offset = centeredIndex * 26
    }

    geometries.set(transition.id, createEdgeGeometry(transition, source, target, offset, labelText))
  }

  return geometries
}

export function measureSceneBounds(
  states: StateNode[],
  transitionGeometries: Iterable<TransitionGeometry>,
): Bounds {
  const bounds = createEmptyBounds()

  for (const state of states) {
    const startArrowLeft = state.isStart ? state.x - STATE_RADIUS - 56 : state.x - STATE_RADIUS
    expandBounds(bounds, startArrowLeft, state.y - STATE_RADIUS)
    expandBounds(bounds, state.x + STATE_RADIUS, state.y + STATE_RADIUS)
  }

  for (const geometry of transitionGeometries) {
    expandBounds(bounds, geometry.bbox.minX, geometry.bbox.minY)
    expandBounds(bounds, geometry.bbox.maxX, geometry.bbox.maxY)
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 240, maxY: 160 }
  }

  return bounds
}
