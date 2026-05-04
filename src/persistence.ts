import {
  clampStatePosition,
  type StateNode,
  type Transition,
  validateTransition,
} from './model'

export interface AutomatonDocument {
  version: 1
  states: StateNode[]
  transitions: Transition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new Error(message)
  }

  return value
}

function expectBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(message)
  }

  return value
}

function expectNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message)
  }

  return value
}

function parseState(value: unknown, index: number): StateNode {
  if (!isRecord(value)) {
    throw new Error(`State ${index + 1} must be an object.`)
  }

  const id = expectString(value.id, `State ${index + 1} is missing a string id.`).trim()
  const label = expectString(value.label, `State ${index + 1} is missing a string label.`).trim()
  const x = expectNumber(value.x, `State ${index + 1} is missing a numeric x position.`)
  const y = expectNumber(value.y, `State ${index + 1} is missing a numeric y position.`)
  const isStart = expectBoolean(value.isStart, `State ${index + 1} is missing a boolean isStart flag.`)
  const isAccept = expectBoolean(value.isAccept, `State ${index + 1} is missing a boolean isAccept flag.`)

  if (id.length === 0) {
    throw new Error(`State ${index + 1} has an empty id.`)
  }

  const position = clampStatePosition(x, y)

  return {
    id,
    label: label || id,
    x: position.x,
    y: position.y,
    isStart,
    isAccept,
  }
}

function parseTransition(value: unknown, index: number): Transition {
  if (!isRecord(value)) {
    throw new Error(`Transition ${index + 1} must be an object.`)
  }

  return {
    id: expectString(value.id, `Transition ${index + 1} is missing a string id.`).trim(),
    fromId: expectString(value.fromId, `Transition ${index + 1} is missing a string fromId.`).trim(),
    toId: expectString(value.toId, `Transition ${index + 1} is missing a string toId.`).trim(),
    input: expectString(value.input, `Transition ${index + 1} is missing a string input.`).trim(),
    stackTop: expectString(value.stackTop, `Transition ${index + 1} is missing a string stackTop.`).trim(),
    stackResult: expectString(value.stackResult, `Transition ${index + 1} is missing a string stackResult.`).trim(),
  }
}

export function serializeAutomaton(states: StateNode[], transitions: Transition[]): string {
  const document: AutomatonDocument = {
    version: 1,
    states,
    transitions,
  }

  return JSON.stringify(document, null, 2)
}

export function parseAutomaton(json: string): AutomatonDocument {
  let raw: unknown

  try {
    raw = JSON.parse(json) as unknown
  } catch {
    throw new Error('File is not valid JSON.')
  }

  if (!isRecord(raw)) {
    throw new Error('Automaton file must be a JSON object.')
  }

  if ('version' in raw && raw.version !== 1) {
    throw new Error('Unsupported automaton file version.')
  }

  if (!Array.isArray(raw.states)) {
    throw new Error('Automaton file is missing a states array.')
  }

  if (!Array.isArray(raw.transitions)) {
    throw new Error('Automaton file is missing a transitions array.')
  }

  const states = raw.states.map((state, index) => parseState(state, index))
  const transitions = raw.transitions.map((transition, index) => parseTransition(transition, index))
  const stateIds = new Set<string>()
  const transitionIds = new Set<string>()
  let startCount = 0

  for (const state of states) {
    if (stateIds.has(state.id)) {
      throw new Error(`Duplicate state id: ${state.id}.`)
    }

    stateIds.add(state.id)

    if (state.isStart) {
      startCount += 1
    }
  }

  if (startCount > 1) {
    throw new Error('Automaton file can contain only one start state.')
  }

  for (const transition of transitions) {
    if (transition.id.length === 0) {
      throw new Error('Transition id cannot be empty.')
    }

    if (transitionIds.has(transition.id)) {
      throw new Error(`Duplicate transition id: ${transition.id}.`)
    }

    if (!stateIds.has(transition.fromId) || !stateIds.has(transition.toId)) {
      throw new Error(`Transition ${transition.id} references a missing state.`)
    }

    const validationErrors = validateTransition(transition)

    if (validationErrors.length > 0) {
      throw new Error(`Transition ${transition.id} is invalid: ${validationErrors.join(' ')}`)
    }

    transitionIds.add(transition.id)
  }

  return {
    version: 1,
    states,
    transitions,
  }
}

export function downloadAutomatonJson(states: StateNode[], transitions: Transition[]): void {
  const json = serializeAutomaton(states, transitions)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'pda.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
