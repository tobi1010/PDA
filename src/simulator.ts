import { EPSILON_TOKEN, STACK_END_SYMBOL, type StateNode, type Transition, validateTransition } from './model'

const MAX_CONFIGURATIONS = 100000
const STACK_SEPARATOR = '\u0001'

interface Configuration {
  stateId: string
  inputIndex: number
  stack: string[]
}

interface Predecessor {
  previousKey: string | null
  transitionId: string | null
}

export interface SimulationTraceStep {
  stateId: string
  inputIndex: number
  stack: string[]
  transitionId: string | null
}

export interface SimulationResult {
  status: 'accepted' | 'rejected' | 'error'
  message: string
  trace: SimulationTraceStep[]
  explored: number
}

function createConfigurationKey(configuration: Configuration): string {
  return `${configuration.stateId}|${configuration.inputIndex}|${configuration.stack.join(STACK_SEPARATOR)}`
}

function applyTransition(configuration: Configuration, transition: Transition, inputSymbols: string[]): Configuration | null {
  if (transition.input !== EPSILON_TOKEN) {
    if (configuration.inputIndex >= inputSymbols.length || inputSymbols[configuration.inputIndex] !== transition.input) {
      return null
    }
  }

  const nextStack = [...configuration.stack]

  if (transition.stackTop !== EPSILON_TOKEN) {
    const top = nextStack.at(-1)

    if (top !== transition.stackTop) {
      return null
    }

    nextStack.pop()
  }

  if (transition.stackResult !== EPSILON_TOKEN) {
    nextStack.push(transition.stackResult)
  }

  return {
    stateId: transition.toId,
    inputIndex: configuration.inputIndex + (transition.input === EPSILON_TOKEN ? 0 : 1),
    stack: nextStack,
  }
}

function reconstructTrace(
  endKey: string,
  configurations: Map<string, Configuration>,
  predecessors: Map<string, Predecessor>,
): SimulationTraceStep[] {
  const reversedTrace: SimulationTraceStep[] = []
  let currentKey: string | null = endKey

  while (currentKey !== null) {
    const configuration = configurations.get(currentKey)
    const predecessor = predecessors.get(currentKey)

    if (!configuration || !predecessor) {
      break
    }

    reversedTrace.push({
      stateId: configuration.stateId,
      inputIndex: configuration.inputIndex,
      stack: [...configuration.stack],
      transitionId: predecessor.transitionId,
    })

    currentKey = predecessor.previousKey
  }

  return reversedTrace.reverse()
}

export function simulateWord(states: StateNode[], transitions: Transition[], word: string): SimulationResult {
  const invalidTransition = transitions.find((transition) => validateTransition(transition).length > 0)

  if (invalidTransition) {
    return {
      status: 'error',
      message: `Transition ${invalidTransition.id} is invalid. Fix the transition before running the PDA.`,
      trace: [],
      explored: 0,
    }
  }

  const startStates = states.filter(({ isStart }) => isStart)

  if (startStates.length !== 1) {
    return {
      status: 'error',
      message: 'Exactly one start state is required to run the PDA.',
      trace: [],
      explored: 0,
    }
  }

  if (states.every(({ isAccept }) => !isAccept)) {
    return {
      status: 'error',
      message: 'At least one accept state is required to run the PDA.',
      trace: [],
      explored: 0,
    }
  }

  const inputSymbols = Array.from(word)
  const outgoingTransitions = new Map<string, Transition[]>()

  for (const transition of transitions) {
    const stateTransitions = outgoingTransitions.get(transition.fromId)

    if (stateTransitions) {
      stateTransitions.push(transition)
    } else {
      outgoingTransitions.set(transition.fromId, [transition])
    }
  }

  const initialConfiguration: Configuration = {
    stateId: startStates[0].id,
    inputIndex: 0,
    stack: [STACK_END_SYMBOL],
  }
  const initialKey = createConfigurationKey(initialConfiguration)
  const queue: Configuration[] = [initialConfiguration]
  const visited = new Set([initialKey])
  const configurations = new Map<string, Configuration>([[initialKey, initialConfiguration]])
  const predecessors = new Map<string, Predecessor>([[initialKey, { previousKey: null, transitionId: null }]])
  const stateById = new Map(states.map((state) => [state.id, state]))
  let explored = 0

  while (queue.length > 0) {
    if (visited.size > MAX_CONFIGURATIONS) {
      return {
        status: 'error',
        message: 'Run limit reached. The PDA may have an unbounded epsilon search.',
        trace: [],
        explored,
      }
    }

    const currentConfiguration = queue.shift()!
    const currentKey = createConfigurationKey(currentConfiguration)
    const currentState = stateById.get(currentConfiguration.stateId)

    explored += 1

    if (!currentState) {
      continue
    }

    if (currentState.isAccept && currentConfiguration.inputIndex === inputSymbols.length) {
      return {
        status: 'accepted',
        message: 'Word accepted.',
        trace: reconstructTrace(currentKey, configurations, predecessors),
        explored,
      }
    }

    const possibleTransitions = outgoingTransitions.get(currentConfiguration.stateId) ?? []

    for (const transition of possibleTransitions) {
      const nextConfiguration = applyTransition(currentConfiguration, transition, inputSymbols)

      if (!nextConfiguration) {
        continue
      }

      const nextKey = createConfigurationKey(nextConfiguration)

      if (visited.has(nextKey)) {
        continue
      }

      visited.add(nextKey)
      configurations.set(nextKey, nextConfiguration)
      predecessors.set(nextKey, { previousKey: currentKey, transitionId: transition.id })
      queue.push(nextConfiguration)
    }
  }

  return {
    status: 'rejected',
    message: 'Word rejected.',
    trace: [],
    explored,
  }
}
