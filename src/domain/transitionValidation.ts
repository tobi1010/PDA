import { EPSILON_TOKEN, STACK_END_SYMBOL } from './automaton'
import { type Transition } from './editorTypes'

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
