import { type StateNode, type Transition } from './editorTypes'

export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 840
export const GRID_SIZE = 40
export const STATE_RADIUS = 32
export const EPSILON_TOKEN = '\\e'
export const EPSILON_SYMBOL = 'ε'
export const STACK_END_SYMBOL = '$'

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function clampStatePosition(x: number, y: number): Pick<StateNode, 'x' | 'y'> {
  const min = STATE_RADIUS + GRID_SIZE / 2
  const maxX = CANVAS_WIDTH - STATE_RADIUS - GRID_SIZE / 2
  const maxY = CANVAS_HEIGHT - STATE_RADIUS - GRID_SIZE / 2

  return {
    x: Math.min(Math.max(snapToGrid(x), min), maxX),
    y: Math.min(Math.max(snapToGrid(y), min), maxY),
  }
}

export function createState(id: string, label: string, x: number, y: number): StateNode {
  const position = clampStatePosition(x, y)

  return {
    id,
    label,
    x: position.x,
    y: position.y,
    isStart: false,
    isAccept: false,
  }
}

export function createTransition(id: string, fromId: string, toId: string): Transition {
  return {
    id,
    fromId,
    toId,
    input: EPSILON_TOKEN,
    stackTop: EPSILON_TOKEN,
    stackResult: EPSILON_TOKEN,
  }
}

export function displayToken(token: string): string {
  const trimmed = token.trim()
  return trimmed === EPSILON_TOKEN ? EPSILON_SYMBOL : trimmed
}

export function formatTransitionLabel(transition: Transition): string {
  return `${displayToken(transition.input)} | ${displayToken(transition.stackTop)} → ${displayToken(transition.stackResult)}`
}
