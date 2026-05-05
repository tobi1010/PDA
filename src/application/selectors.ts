import { type EditorState } from './editorStore'
import { type StateNode, type Transition } from '../domain/editorTypes'

export function getSelectedState(state: EditorState): StateNode | null {
  const selection = state.ui.selection

  if (selection?.type !== 'state') {
    return null
  }

  return state.automaton.states.find((item) => item.id === selection.id) ?? null
}

export function getSelectedTransition(state: EditorState): Transition | null {
  const selection = state.ui.selection

  if (selection?.type !== 'transition') {
    return null
  }

  return state.automaton.transitions.find((item) => item.id === selection.id) ?? null
}

export function getCurrentRunStateIds(state: EditorState): string[] {
  if (state.runner.stepIndex < 0) {
    return []
  }

  return state.runner.result?.steps[state.runner.stepIndex]?.activeStateIds ?? []
}

export function getStatusText(state: EditorState): string {
  if (state.ui.notice !== null) {
    return state.ui.notice
  }

  if (state.ui.mode === 'add-state') {
    return 'Add state mode: click the canvas to place a new state on the grid.'
  }

  if (state.ui.mode === 'connect') {
    return state.ui.connectFromId
      ? 'Connect mode: choose the target state to create a transition.'
      : 'Connect mode: choose the source state.'
  }

  const selectedState = getSelectedState(state)

  if (selectedState) {
    return `Selected state ${selectedState.label}. Drag it to a new grid position.`
  }

  if (state.ui.selection?.type === 'transition') {
    return 'Selected transition. Edit its three single-symbol fields in the inspector.'
  }

  return 'Select mode: drag states, edit the inspector, or switch to connect mode.'
}

export function getToolbarState(state: EditorState): {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canRun: boolean
  canResetRun: boolean
  canExport: boolean
} {
  return {
    canUndo: state.history.undo.length > 0,
    canRedo: state.history.redo.length > 0,
    hasSelection: state.ui.selection !== null,
    canRun: state.automaton.states.length > 0,
    canResetRun: state.runner.result !== null || state.runner.stepIndex >= 0,
    canExport: state.automaton.states.length > 0,
  }
}
