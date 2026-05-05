import { createHistoryState, type HistoryState } from '../domain/history'
import { type EditorMode, type Selection, type StateNode, type Transition } from '../domain/editorTypes'
import { type SimulationResult } from '../simulator'

export interface EditorSnapshot {
  states: StateNode[]
  transitions: Transition[]
  selection: Selection
  connectFromId: string | null
  mode: EditorMode
}

export interface EditorState {
  automaton: {
    states: StateNode[]
    transitions: Transition[]
    nextStateIndex: number
    nextTransitionIndex: number
  }
  ui: {
    selection: Selection
    mode: EditorMode
    connectFromId: string | null
    notice: string | null
  }
  runner: {
    word: string
    result: SimulationResult | null
    stepIndex: number
  }
  history: HistoryState<EditorSnapshot>
}

export class EditorStore {
  private state: EditorState = createInitialEditorState()

  public getState(): EditorState {
    return this.state
  }

  public update(updater: (state: EditorState) => EditorState): void {
    this.state = updater(this.state)
  }

  public replace(state: EditorState): void {
    this.state = state
  }
}

export function createInitialEditorState(): EditorState {
  return {
    automaton: {
      states: [],
      transitions: [],
      nextStateIndex: 0,
      nextTransitionIndex: 0,
    },
    ui: {
      selection: null,
      mode: 'select',
      connectFromId: null,
      notice: null,
    },
    runner: {
      word: '',
      result: null,
      stepIndex: -1,
    },
    history: createHistoryState(),
  }
}

export function captureSnapshot(state: EditorState): EditorSnapshot {
  return {
    states: state.automaton.states.map((item) => ({ ...item })),
    transitions: state.automaton.transitions.map((item) => ({ ...item })),
    selection: state.ui.selection === null ? null : { ...state.ui.selection },
    connectFromId: state.ui.connectFromId,
    mode: state.ui.mode,
  }
}

export function applySnapshot(state: EditorState, snapshot: EditorSnapshot): EditorState {
  return {
    ...state,
    automaton: {
      ...state.automaton,
      states: snapshot.states.map((item) => ({ ...item })),
      transitions: snapshot.transitions.map((item) => ({ ...item })),
    },
    ui: {
      ...state.ui,
      selection: snapshot.selection === null ? null : { ...snapshot.selection },
      connectFromId: snapshot.connectFromId,
      mode: snapshot.mode,
    },
  }
}

export function snapshotsMatch(left: EditorSnapshot, right: EditorSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
