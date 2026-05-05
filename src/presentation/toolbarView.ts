import { type EditorMode } from '../domain/editorTypes'

export interface ToolbarElements {
  undoButton: HTMLButtonElement
  redoButton: HTMLButtonElement
  selectButton: HTMLButtonElement
  addStateButton: HTMLButtonElement
  connectButton: HTMLButtonElement
  deleteButton: HTMLButtonElement
  runButton: HTMLButtonElement
  stepButton: HTMLButtonElement
  resetRunButton: HTMLButtonElement
  exportButton: HTMLButtonElement
}

export interface ToolbarViewModel {
  mode: EditorMode
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canRun: boolean
  canResetRun: boolean
  canExport: boolean
}

export function renderToolbarView(elements: ToolbarElements, model: ToolbarViewModel): void {
  const modeButtons = [
    [elements.selectButton, 'select'],
    [elements.addStateButton, 'add-state'],
    [elements.connectButton, 'connect'],
  ] as const

  for (const [button, mode] of modeButtons) {
    button.classList.toggle('is-active', model.mode === mode)
  }

  elements.undoButton.disabled = !model.canUndo
  elements.redoButton.disabled = !model.canRedo
  elements.deleteButton.disabled = !model.hasSelection
  elements.runButton.disabled = !model.canRun
  elements.stepButton.disabled = !model.canRun
  elements.resetRunButton.disabled = !model.canResetRun
  elements.exportButton.disabled = !model.canExport
}
