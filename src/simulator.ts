import { EPSILON_TOKEN, type StateNode, type Transition, validateTransition } from './model'

const MAX_CONFIGURATIONS = 100000
const STACK_SEPARATOR = '\u0001'

interface Configuration {
  stateId: string
  inputIndex: number
  stack: string[]
}

export interface SimulationStepConfiguration {
  stateId: string
  stack: string[]
}

export interface SimulationStep {
  inputIndex: number
  activeStateIds: string[]
  configurations: SimulationStepConfiguration[]
}

export interface SimulationResult {
  status: 'accepted' | 'rejected' | 'error'
  message: string
  steps: SimulationStep[]
  explored: number
}

function createConfigurationKey(configuration: Configuration): string {
  return `${configuration.stateId}|${configuration.inputIndex}|${configuration.stack.join(STACK_SEPARATOR)}`
}

function cloneConfiguration(configuration: Configuration): Configuration {
  return {
    stateId: configuration.stateId,
    inputIndex: configuration.inputIndex,
    stack: [...configuration.stack],
  }
}

function applyTransition(configuration: Configuration, transition: Transition): Configuration | null {
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

function buildStep(configurations: Configuration[], inputIndex: number): SimulationStep {
  const activeStateIds = [...new Set(configurations.map(({ stateId }) => stateId))].sort()
  const snapshotConfigurations = configurations
    .map((configuration) => ({
      stateId: configuration.stateId,
      stack: [...configuration.stack],
    }))
    .sort((left, right) => {
      const stateCompare = left.stateId.localeCompare(right.stateId)

      if (stateCompare !== 0) {
        return stateCompare
      }

      return right.stack.length - left.stack.length || left.stack.join(STACK_SEPARATOR).localeCompare(right.stack.join(STACK_SEPARATOR))
    })

  return {
    inputIndex,
    activeStateIds,
    configurations: snapshotConfigurations,
  }
}

function epsilonClosure(
  initialConfigurations: Configuration[],
  outgoingTransitions: Map<string, Transition[]>,
  discoveredKeys: Set<string>,
): { configurations: Configuration[]; overflow: boolean } {
  const queue: Configuration[] = []
  const closure = new Map<string, Configuration>()

  for (const configuration of initialConfigurations) {
    const key = createConfigurationKey(configuration)

    if (closure.has(key)) {
      continue
    }

    const nextConfiguration = cloneConfiguration(configuration)
    closure.set(key, nextConfiguration)
    queue.push(nextConfiguration)
    discoveredKeys.add(key)

    if (discoveredKeys.size > MAX_CONFIGURATIONS) {
      return { configurations: [], overflow: true }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const transitions = outgoingTransitions.get(current.stateId) ?? []

    for (const transition of transitions) {
      if (transition.input !== EPSILON_TOKEN) {
        continue
      }

      const nextConfiguration = applyTransition(current, transition)

      if (!nextConfiguration) {
        continue
      }

      const key = createConfigurationKey(nextConfiguration)

      if (closure.has(key)) {
        continue
      }

      closure.set(key, nextConfiguration)
      queue.push(nextConfiguration)
      discoveredKeys.add(key)

      if (discoveredKeys.size > MAX_CONFIGURATIONS) {
        return { configurations: [], overflow: true }
      }
    }
  }

  return {
    configurations: [...closure.values()],
    overflow: false,
  }
}

export function simulateWord(states: StateNode[], transitions: Transition[], word: string): SimulationResult {
  const invalidTransition = transitions.find((transition) => validateTransition(transition).length > 0)

  if (invalidTransition) {
    return {
      status: 'error',
      message: `Transition ${invalidTransition.id} is invalid. Fix the transition before running the PDA.`,
      steps: [],
      explored: 0,
    }
  }

  const startStates = states.filter(({ isStart }) => isStart)

  if (startStates.length !== 1) {
    return {
      status: 'error',
      message: 'Exactly one start state is required to run the PDA.',
      steps: [],
      explored: 0,
    }
  }

  if (states.every(({ isAccept }) => !isAccept)) {
    return {
      status: 'error',
      message: 'At least one accept state is required to run the PDA.',
      steps: [],
      explored: 0,
    }
  }

  const inputSymbols = Array.from(word)
  const outgoingTransitions = new Map<string, Transition[]>()
  const stateById = new Map(states.map((state) => [state.id, state]))
  const discoveredKeys = new Set<string>()

  for (const transition of transitions) {
    const stateTransitions = outgoingTransitions.get(transition.fromId)

    if (stateTransitions) {
      stateTransitions.push(transition)
    } else {
      outgoingTransitions.set(transition.fromId, [transition])
    }
  }

  let frontier: Configuration[] = [{
    stateId: startStates[0].id,
    inputIndex: 0,
    stack: [],
  }]
  const steps: SimulationStep[] = []

  const initialClosure = epsilonClosure(frontier, outgoingTransitions, discoveredKeys)

  if (initialClosure.overflow) {
    return {
      status: 'error',
      message: 'Run limit reached. The PDA may have an unbounded epsilon search.',
      steps: [],
      explored: discoveredKeys.size,
    }
  }

  frontier = initialClosure.configurations
  steps.push(buildStep(frontier, 0))

  for (const [index, inputSymbol] of inputSymbols.entries()) {
    const nextConfigurations = new Map<string, Configuration>()

    for (const configuration of frontier) {
      const possibleTransitions = outgoingTransitions.get(configuration.stateId) ?? []

      for (const transition of possibleTransitions) {
        if (transition.input !== inputSymbol) {
          continue
        }

        const nextConfiguration = applyTransition(configuration, transition)

        if (!nextConfiguration) {
          continue
        }

        nextConfigurations.set(createConfigurationKey(nextConfiguration), nextConfiguration)
      }
    }

    const closure = epsilonClosure([...nextConfigurations.values()], outgoingTransitions, discoveredKeys)

    if (closure.overflow) {
      return {
        status: 'error',
        message: 'Run limit reached. The PDA may have an unbounded epsilon search.',
        steps,
        explored: discoveredKeys.size,
      }
    }

    frontier = closure.configurations
    steps.push(buildStep(frontier, index + 1))
  }

  const finalInputIndex = inputSymbols.length
  const accepted = frontier.some((configuration) => {
    if (configuration.inputIndex !== finalInputIndex) {
      return false
    }

    return stateById.get(configuration.stateId)?.isAccept ?? false
  })

  return {
    status: accepted ? 'accepted' : 'rejected',
    message: accepted ? 'Word accepted.' : 'Word rejected.',
    steps,
    explored: discoveredKeys.size,
  }
}
