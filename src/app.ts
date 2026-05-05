import './style.css'
import { downloadAutomatonJson, parseAutomaton } from './infrastructure/persistence'
import { simulateWord } from './simulator'
import { downloadAutomatonSvg } from './infrastructure/svgExport'
import {
  EPSILON_TOKEN,
  clampStatePosition,
  createState,
  createTransition,
  type EditorMode,
} from './model'
import { EditorStore, applySnapshot, captureSnapshot, type EditorSnapshot } from './application/editorStore'
import {
  getCurrentRunStateIds,
  getSelectedState,
  getSelectedTransition,
  getStatusText,
  getToolbarState,
} from './application/selectors'
import { computeNextIndex, createNextId, parseTrailingNumber } from './domain/ids'
import { commitHistory, takeRedoSnapshot, takeUndoSnapshot } from './domain/history'
import { buildAppShellMarkup } from './presentation/appShell'
import { renderCanvasView } from './presentation/canvasView'
import {
  renderEmptyInspector,
  renderStateInspector,
  renderTransitionInspector,
} from './presentation/inspectorView'
import { renderRunnerView } from './presentation/runnerView'
import { renderStatusView } from './presentation/statusView'
import { renderToolbarView, type ToolbarElements } from './presentation/toolbarView'

const HISTORY_LIMIT = 10

interface DragState {
  stateId: string
  offsetX: number
  offsetY: number
  didMove: boolean
  originSnapshot: EditorSnapshot
}

export class EditorApp {
  private readonly root: HTMLElement
  private readonly store = new EditorStore()
  private readonly canvasHost: HTMLDivElement
  private readonly inspectorHost: HTMLDivElement
  private readonly statusHost: HTMLParagraphElement
  private readonly runnerInput: HTMLInputElement
  private readonly runnerResultHost: HTMLDivElement
  private readonly fileInput: HTMLInputElement
  private readonly toolbarElements: ToolbarElements
  private noticeTimeout = 0
  private dragState: DragState | null = null

  public constructor(root: HTMLElement) {
    this.root = root
    this.root.innerHTML = buildAppShellMarkup()

    this.canvasHost = this.root.querySelector<HTMLDivElement>('.canvas-host')!
    this.inspectorHost = this.root.querySelector<HTMLDivElement>('.inspector-host')!
    this.statusHost = this.root.querySelector<HTMLParagraphElement>('.status-line')!
    this.runnerInput = this.root.querySelector<HTMLInputElement>('[data-runner-input]')!
    this.runnerResultHost = this.root.querySelector<HTMLDivElement>('.runner-result')!
    this.fileInput = this.root.querySelector<HTMLInputElement>('.file-input')!
    this.toolbarElements = {
      undoButton: this.root.querySelector<HTMLButtonElement>('[data-action="undo"]')!,
      redoButton: this.root.querySelector<HTMLButtonElement>('[data-action="redo"]')!,
      selectButton: this.root.querySelector<HTMLButtonElement>('[data-mode="select"]')!,
      addStateButton: this.root.querySelector<HTMLButtonElement>('[data-mode="add-state"]')!,
      connectButton: this.root.querySelector<HTMLButtonElement>('[data-mode="connect"]')!,
      deleteButton: this.root.querySelector<HTMLButtonElement>('[data-action="delete"]')!,
      runButton: this.root.querySelector<HTMLButtonElement>('[data-action="run"]')!,
      stepButton: this.root.querySelector<HTMLButtonElement>('[data-action="step"]')!,
      resetRunButton: this.root.querySelector<HTMLButtonElement>('[data-action="reset-run"]')!,
      exportButton: this.root.querySelector<HTMLButtonElement>('[data-action="export"]')!,
    }

    this.bindStaticEvents()
    this.render()
  }

  private get state() {
    return this.store.getState()
  }

  private bindStaticEvents(): void {
    this.toolbarElements.selectButton.addEventListener('click', () => this.setMode('select'))
    this.toolbarElements.addStateButton.addEventListener('click', () => this.setMode('add-state'))
    this.toolbarElements.connectButton.addEventListener('click', () => this.setMode('connect'))
    this.toolbarElements.undoButton.addEventListener('click', () => this.undo())
    this.toolbarElements.redoButton.addEventListener('click', () => this.redo())
    this.root.querySelector<HTMLButtonElement>('[data-action="load"]')!.addEventListener('click', () => this.openJsonFilePicker())
    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')!.addEventListener('click', () => this.saveJson())
    this.toolbarElements.runButton.addEventListener('click', () => this.runFullSimulation())
    this.toolbarElements.stepButton.addEventListener('click', () => this.stepSimulation())
    this.toolbarElements.resetRunButton.addEventListener('click', () => this.resetSimulation())
    this.toolbarElements.deleteButton.addEventListener('click', () => this.deleteSelection())
    this.toolbarElements.exportButton.addEventListener('click', () => this.exportSvg())

    this.runnerInput.addEventListener('input', () => {
      this.store.update((state) => ({
        ...state,
        runner: {
          word: this.runnerInput.value,
          result: null,
          stepIndex: -1,
        },
      }))
      this.renderRunner()
      this.renderCanvas()
      this.renderToolbar()
    })

    this.runnerInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.runFullSimulation()
      }
    })

    this.fileInput.addEventListener('change', () => {
      void this.handleFileSelection()
    })

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          return
        }

        event.preventDefault()
        this.deleteSelection()
      }

      if (event.key === 'Escape') {
        this.clearConnectModeSelection()
        this.setMode('select')
      }
    })
  }

  private render(): void {
    this.renderToolbar()
    this.renderCanvas()
    this.renderInspector()
    this.renderRunner()
    this.renderStatus()
  }

  private renderToolbar(): void {
    const state = this.state
    renderToolbarView(this.toolbarElements, {
      mode: state.ui.mode,
      ...getToolbarState(state),
    })
  }

  private renderCanvas(): void {
    const state = this.state

    renderCanvasView(
      this.canvasHost,
      {
        states: state.automaton.states,
        transitions: state.automaton.transitions,
        selection: state.ui.selection,
        connectFromId: state.ui.connectFromId,
        runStateIds: getCurrentRunStateIds(state),
      },
      {
        onCanvasClick: (event, svg) => this.handleCanvasClick(event, svg),
        onStateClick: (event, stateId) => this.handleStateClick(event, stateId),
        onStateMouseDown: (event, stateId, svg) => this.handleStateMouseDown(event, stateId, svg),
        onTransitionClick: (event, transitionId) => {
          event.stopPropagation()
          this.store.update((current) => ({
            ...current,
            ui: {
              ...current.ui,
              selection: { type: 'transition', id: transitionId },
            },
          }))
          this.render()
        },
      },
    )
  }

  private renderInspector(): void {
    const state = this.state
    const selectedState = getSelectedState(state)

    if (selectedState) {
      renderStateInspector(this.inspectorHost, selectedState, {
        onLabelChange: (value) => this.updateStateLabel(selectedState.id, value),
        onStartChange: (checked) => this.updateStateStart(selectedState.id, checked),
        onAcceptChange: (checked) => this.updateStateAccept(selectedState.id, checked),
      })
      return
    }

    const selectedTransition = getSelectedTransition(state)

    if (selectedTransition) {
      renderTransitionInspector(this.inspectorHost, selectedTransition, EPSILON_TOKEN, {
        onFieldChange: (key, value) => this.updateTransitionField(selectedTransition.id, key, value),
      })
      return
    }

    renderEmptyInspector(this.inspectorHost)
  }

  private renderRunner(): void {
    const state = this.state
    renderRunnerView(this.runnerResultHost, this.runnerInput, {
      word: state.runner.word,
      result: state.runner.result,
      stepIndex: state.runner.stepIndex,
      states: state.automaton.states,
    })
  }

  private renderStatus(): void {
    renderStatusView(this.statusHost, getStatusText(this.state))
  }

  private setMode(mode: EditorMode): void {
    this.store.update((state) => ({
      ...state,
      ui: {
        ...state.ui,
        mode,
        connectFromId: mode === 'connect' ? state.ui.connectFromId : null,
      },
    }))
    this.render()
  }

  private handleCanvasClick(event: MouseEvent, svg: SVGSVGElement): void {
    const state = this.state

    if (state.ui.mode === 'add-state') {
      const point = this.clientToSvgPoint(event, svg)
      this.addState(point.x, point.y)
      return
    }

    if (state.ui.mode === 'connect') {
      this.clearConnectModeSelection()
      this.render()
      return
    }

    this.store.update((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selection: null,
      },
    }))
    this.render()
  }

  private handleStateClick(event: MouseEvent, stateId: string): void {
    event.stopPropagation()
    const state = this.state

    if (state.ui.mode === 'connect') {
      if (state.ui.connectFromId === null) {
        this.store.update((current) => ({
          ...current,
          ui: {
            ...current.ui,
            connectFromId: stateId,
            selection: { type: 'state', id: stateId },
          },
        }))
        this.render()
        return
      }

      const transitionId = createNextId(
        't',
        state.automaton.transitions.map(({ id }) => id),
        state.automaton.nextTransitionIndex,
      )
      const transition = createTransition(transitionId, state.ui.connectFromId, stateId)
      const previousSnapshot = this.captureCurrentSnapshot()

      this.store.update((current) => ({
        ...current,
        automaton: {
          ...current.automaton,
          transitions: [...current.automaton.transitions, transition],
          nextTransitionIndex: parseTrailingNumber(transitionId, 't') + 1,
        },
        ui: {
          ...current.ui,
          connectFromId: null,
          selection: { type: 'transition', id: transition.id },
        },
      }))
      this.commitSnapshot(previousSnapshot)
      this.clearNotice()
      this.resetSimulationState()
      this.render()
      return
    }

    this.store.update((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selection: { type: 'state', id: stateId },
      },
    }))
    this.render()
  }

  private handleStateMouseDown(event: MouseEvent, stateId: string, svg: SVGSVGElement): void {
    const state = this.state

    if (event.button !== 0 || state.ui.mode !== 'select') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const selectedState = state.automaton.states.find((item) => item.id === stateId)

    if (!selectedState) {
      return
    }

    const point = this.clientToSvgPoint(event, svg)

    this.store.update((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selection: { type: 'state', id: stateId },
      },
    }))
    this.dragState = {
      stateId,
      offsetX: point.x - selectedState.x,
      offsetY: point.y - selectedState.y,
      didMove: false,
      originSnapshot: this.captureCurrentSnapshot(),
    }
    this.render()

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!this.dragState) {
        return
      }

      const currentSvg = this.canvasHost.querySelector<SVGSVGElement>('svg')

      if (!currentSvg) {
        return
      }

      const dragPoint = this.clientToSvgPoint(moveEvent, currentSvg)
      const position = clampStatePosition(
        dragPoint.x - this.dragState.offsetX,
        dragPoint.y - this.dragState.offsetY,
      )
      const currentState = this.state.automaton.states.find((item) => item.id === this.dragState?.stateId)

      if (!currentState) {
        return
      }

      this.dragState.didMove ||= currentState.x !== position.x || currentState.y !== position.y

      this.store.update((current) => ({
        ...current,
        automaton: {
          ...current.automaton,
          states: current.automaton.states.map((item) =>
            item.id === this.dragState?.stateId ? { ...item, x: position.x, y: position.y } : item,
          ),
        },
      }))
      this.clearNotice()
      this.renderCanvas()
      this.renderStatus()
    }

    const handleMouseUp = (): void => {
      const dragState = this.dragState
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      if (dragState?.didMove) {
        this.commitSnapshot(dragState.originSnapshot)
      }

      this.dragState = null
      this.renderToolbar()
      this.renderCanvas()
      this.renderStatus()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  private addState(x: number, y: number): void {
    const state = this.state
    const stateId = createNextId('q', state.automaton.states.map(({ id }) => id), state.automaton.nextStateIndex)
    const nextState = createState(stateId, stateId, x, y)
    const previousSnapshot = this.captureCurrentSnapshot()

    this.store.update((current) => ({
      ...current,
      automaton: {
        ...current.automaton,
        states: [...current.automaton.states, nextState],
        nextStateIndex: parseTrailingNumber(stateId, 'q') + 1,
      },
      ui: {
        ...current.ui,
        selection: { type: 'state', id: nextState.id },
      },
    }))
    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.resetSimulationState()
    this.render()
  }

  private updateStateLabel(stateId: string, value: string): void {
    const state = this.state.automaton.states.find((item) => item.id === stateId)

    if (!state) {
      return
    }

    const nextLabel = value.trim() || state.id

    if (state.label === nextLabel) {
      return
    }

    const previousSnapshot = this.captureCurrentSnapshot()
    this.store.update((current) => ({
      ...current,
      automaton: {
        ...current.automaton,
        states: current.automaton.states.map((item) =>
          item.id === stateId ? { ...item, label: nextLabel } : item,
        ),
      },
    }))
    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.renderCanvas()
    this.renderStatus()
    this.renderToolbar()
  }

  private updateStateStart(stateId: string, checked: boolean): void {
    const previousSnapshot = this.captureCurrentSnapshot()

    this.store.update((current) => ({
      ...current,
      automaton: {
        ...current.automaton,
        states: current.automaton.states.map((item) => ({
          ...item,
          isStart: item.id === stateId ? checked : false,
        })),
      },
    }))
    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.resetSimulationState()
    this.render()
  }

  private updateStateAccept(stateId: string, checked: boolean): void {
    const previousSnapshot = this.captureCurrentSnapshot()

    this.store.update((current) => ({
      ...current,
      automaton: {
        ...current.automaton,
        states: current.automaton.states.map((item) =>
          item.id === stateId ? { ...item, isAccept: checked } : item,
        ),
      },
    }))
    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.resetSimulationState()
    this.render()
  }

  private updateTransitionField(
    transitionId: string,
    key: 'input' | 'stackTop' | 'stackResult',
    value: string,
  ): void {
    const transition = this.state.automaton.transitions.find((item) => item.id === transitionId)

    if (!transition) {
      return
    }

    const nextValue = value.trim()

    if (transition[key] === nextValue) {
      return
    }

    const previousSnapshot = this.captureCurrentSnapshot()
    this.store.update((current) => ({
      ...current,
      automaton: {
        ...current.automaton,
        transitions: current.automaton.transitions.map((item) =>
          item.id === transitionId ? { ...item, [key]: nextValue } : item,
        ),
      },
    }))
    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.resetSimulationState()
    this.render()
  }

  private deleteSelection(): void {
    const state = this.state

    if (state.ui.selection === null) {
      return
    }

    const previousSnapshot = this.captureCurrentSnapshot()

    if (state.ui.selection.type === 'state') {
      const stateId = state.ui.selection.id

      this.store.update((current) => ({
        ...current,
        automaton: {
          ...current.automaton,
          states: current.automaton.states.filter((item) => item.id !== stateId),
          transitions: current.automaton.transitions.filter(
            ({ fromId, toId }) => fromId !== stateId && toId !== stateId,
          ),
        },
        ui: {
          ...current.ui,
          selection: null,
          connectFromId: current.ui.connectFromId === stateId ? null : current.ui.connectFromId,
        },
      }))
    } else {
      const transitionId = state.ui.selection.id

      this.store.update((current) => ({
        ...current,
        automaton: {
          ...current.automaton,
          transitions: current.automaton.transitions.filter((item) => item.id !== transitionId),
        },
        ui: {
          ...current.ui,
          selection: null,
        },
      }))
    }

    this.commitSnapshot(previousSnapshot)
    this.clearNotice()
    this.resetSimulationState()
    this.render()
  }

  private saveJson(): void {
    const state = this.state
    downloadAutomatonJson(state.automaton.states, state.automaton.transitions)
    this.setNotice(
      `Saved ${state.automaton.states.length} states and ${state.automaton.transitions.length} transitions to JSON.`,
    )
  }

  private openJsonFilePicker(): void {
    this.fileInput.value = ''
    this.fileInput.click()
  }

  private async handleFileSelection(): Promise<void> {
    const [file] = Array.from(this.fileInput.files ?? [])

    if (!file) {
      return
    }

    try {
      const document = parseAutomaton(await file.text())
      const previousSnapshot = this.captureCurrentSnapshot()

      this.store.update((current) => ({
        ...this.recomputeAutomatonIndices({
          ...current,
          automaton: {
            ...current.automaton,
            states: document.states,
            transitions: document.transitions,
            nextStateIndex: 0,
            nextTransitionIndex: 0,
          },
          ui: {
            ...current.ui,
            selection: null,
            connectFromId: null,
            mode: 'select',
          },
        }),
      }))
      this.commitSnapshot(previousSnapshot)
      this.dragState = null
      this.resetSimulationState()
      this.setNotice(`Loaded ${document.states.length} states and ${document.transitions.length} transitions from ${file.name}.`)
      this.render()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load automaton file.'
      this.setNotice(message)
    }
  }

  private exportSvg(): void {
    const state = this.state

    if (state.automaton.states.length === 0) {
      return
    }

    downloadAutomatonSvg(state.automaton.states, state.automaton.transitions)
    this.setNotice('Exported automaton SVG without the editor grid.')
  }

  private runFullSimulation(): void {
    const word = this.runnerInput.value
    const state = this.state
    const result = simulateWord(state.automaton.states, state.automaton.transitions, word)

    this.store.update((current) => ({
      ...current,
      runner: {
        word,
        result,
        stepIndex: result.steps.length - 1,
      },
    }))
    this.renderToolbar()
    this.renderCanvas()
    this.renderRunner()
  }

  private stepSimulation(): void {
    const word = this.runnerInput.value
    const state = this.state
    const needsFreshRun = state.runner.result === null || state.runner.stepIndex >= state.runner.result.steps.length - 1

    if (needsFreshRun) {
      const result = simulateWord(state.automaton.states, state.automaton.transitions, word)
      this.store.update((current) => ({
        ...current,
        runner: {
          word,
          result,
          stepIndex: result.steps.length > 0 ? 0 : -1,
        },
      }))
    } else {
      this.store.update((current) => ({
        ...current,
        runner: {
          ...current.runner,
          word,
          stepIndex: current.runner.stepIndex + 1,
        },
      }))
    }

    this.renderToolbar()
    this.renderCanvas()
    this.renderRunner()
  }

  private resetSimulation(): void {
    this.resetSimulationState()
    this.renderToolbar()
    this.renderCanvas()
    this.renderRunner()
  }

  private resetSimulationState(): void {
    this.store.update((state) => ({
      ...state,
      runner: {
        ...state.runner,
        result: null,
        stepIndex: -1,
      },
    }))
  }

  private undo(): void {
    const currentSnapshot = this.captureCurrentSnapshot()
    const { history, snapshot } = takeUndoSnapshot(this.state.history, currentSnapshot, HISTORY_LIMIT)

    if (snapshot === null) {
      return
    }

    this.store.update((state) => this.recomputeAutomatonIndices({
      ...applySnapshot(state, snapshot),
      history,
      runner: {
        ...state.runner,
        result: null,
        stepIndex: -1,
      },
      ui: {
        ...applySnapshot(state, snapshot).ui,
        notice: null,
      },
    }))
    this.clearNotice()
    this.dragState = null
    this.render()
  }

  private redo(): void {
    const currentSnapshot = this.captureCurrentSnapshot()
    const { history, snapshot } = takeRedoSnapshot(this.state.history, currentSnapshot, HISTORY_LIMIT)

    if (snapshot === null) {
      return
    }

    this.store.update((state) => this.recomputeAutomatonIndices({
      ...applySnapshot(state, snapshot),
      history,
      runner: {
        ...state.runner,
        result: null,
        stepIndex: -1,
      },
      ui: {
        ...applySnapshot(state, snapshot).ui,
        notice: null,
      },
    }))
    this.clearNotice()
    this.dragState = null
    this.render()
  }

  private setNotice(message: string): void {
    this.store.update((state) => ({
      ...state,
      ui: {
        ...state.ui,
        notice: message,
      },
    }))
    window.clearTimeout(this.noticeTimeout)
    this.noticeTimeout = window.setTimeout(() => {
      this.store.update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          notice: null,
        },
      }))
      this.renderStatus()
    }, 4000)
    this.renderStatus()
  }

  private clearNotice(): void {
    window.clearTimeout(this.noticeTimeout)
    this.store.update((state) => ({
      ...state,
      ui: {
        ...state.ui,
        notice: null,
      },
    }))
  }

  private clearConnectModeSelection(): void {
    this.store.update((state) => ({
      ...state,
      ui: {
        ...state.ui,
        connectFromId: null,
      },
    }))
  }

  private captureCurrentSnapshot(): EditorSnapshot {
    return captureSnapshot(this.state)
  }

  private commitSnapshot(previousSnapshot: EditorSnapshot): void {
    const currentSnapshot = this.captureCurrentSnapshot()
    this.store.update((state) => ({
      ...state,
      history: commitHistory(state.history, previousSnapshot, currentSnapshot, (left, right) => JSON.stringify(left) === JSON.stringify(right), HISTORY_LIMIT),
    }))
  }

  private recomputeAutomatonIndices(state: ReturnType<EditorStore['getState']>) {
    return {
      ...state,
      automaton: {
        ...state.automaton,
        nextStateIndex: computeNextIndex(state.automaton.states.map(({ id }) => id), 'q'),
        nextTransitionIndex: computeNextIndex(state.automaton.transitions.map(({ id }) => id), 't'),
      },
    }
  }

  private clientToSvgPoint(event: MouseEvent, svg: SVGSVGElement): DOMPoint {
    const matrix = svg.getScreenCTM()

    if (!matrix) {
      return new DOMPoint(0, 0)
    }

    const point = new DOMPoint(event.clientX, event.clientY)
    return point.matrixTransform(matrix.inverse())
  }
}
