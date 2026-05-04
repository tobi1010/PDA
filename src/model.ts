export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 840
export const GRID_SIZE = 40
export const STATE_RADIUS = 32
export const EPSILON_TOKEN = '\\e'
export const EPSILON_SYMBOL = 'ε'
export const STACK_END_SYMBOL = '$'

export type EditorMode = 'select' | 'add-state' | 'connect'

export interface StateNode {
  id: string
  label: string
  x: number
  y: number
  isStart: boolean
  isAccept: boolean
}

export interface Transition {
  id: string
  fromId: string
  toId: string
  input: string
  stackTop: string
  stackResult: string
}

export type Selection =
  | { type: 'state'; id: string }
  | { type: 'transition'; id: string }
  | null

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

export function validateInputSymbol(raw: string): string | null {
  const token = raw.trim()

  if (token.length === 0) {
    return 'Use one input symbol or \\e.'
  }

  if (token === STACK_END_SYMBOL) {
    return '$ is only allowed in stack fields.'
  }

  if (token === EPSILON_TOKEN) {
    return null
  }

  if ([...token].length !== 1) {
    return 'Input must be one character or \\e.'
  }

  return null
}

export function validateStackSymbol(raw: string, fieldName: string): string | null {
  const token = raw.trim()

  if (token.length === 0) {
    return `Use one stack symbol, $, or \\e for ${fieldName}.`
  }

  if (token === EPSILON_TOKEN || token === STACK_END_SYMBOL) {
    return null
  }

  if ([...token].length !== 1) {
    return `${fieldName} must be one character, $, or \\e.`
  }

  return null
}

export function validateTransition(transition: Transition): string[] {
  const errors = [
    validateInputSymbol(transition.input),
    validateStackSymbol(transition.stackTop, 'stack top'),
    validateStackSymbol(transition.stackResult, 'stack result'),
  ]

  return errors.filter((error): error is string => error !== null)
}
