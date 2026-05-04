import './style.css'
import { downloadAutomatonJson, parseAutomaton } from './persistence'
import { buildSvgMarkup } from './svgScene'
import { downloadAutomatonSvg } from './svgExport'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  EPSILON_TOKEN,
  GRID_SIZE,
  clampStatePosition,
  createState,
  createTransition,
  type EditorMode,
  type Selection,
  type StateNode,
  type Transition,
  validateTransition,
} from './model'

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

interface DragState {
  stateId: string
  offsetX: number
  offsetY: number
}

export class EditorApp {
  private readonly root: HTMLElement
  private readonly canvasHost: HTMLDivElement
  private readonly inspectorHost: HTMLDivElement
  private readonly statusHost: HTMLParagraphElement
  private readonly selectButton: HTMLButtonElement
  private readonly addStateButton: HTMLButtonElement
  private readonly connectButton: HTMLButtonElement
  private readonly loadButton: HTMLButtonElement
  private readonly saveButton: HTMLButtonElement
  private readonly deleteButton: HTMLButtonElement
  private readonly exportButton: HTMLButtonElement
  private readonly fileInput: HTMLInputElement

  private states: StateNode[] = []
  private transitions: Transition[] = []
  private selection: Selection = null
  private mode: EditorMode = 'select'
  private connectFromId: string | null = null
  private nextStateIndex = 0
  private nextTransitionIndex = 0
  private dragState: DragState | null = null
  private notice: string | null = null
  private noticeTimeout = 0

  public constructor(root: HTMLElement) {
    this.root = root
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="toolbar">
          <div class="toolbar-group">
            <button type="button" data-mode="select">Select</button>
            <button type="button" data-mode="add-state">Add state</button>
            <button type="button" data-mode="connect">Connect</button>
          </div>
          <div class="toolbar-group toolbar-group--actions">
            <button type="button" data-action="load">Load JSON</button>
            <button type="button" data-action="save">Save JSON</button>
            <button type="button" data-action="delete">Delete selected</button>
            <button type="button" data-action="export">Export SVG</button>
          </div>
        </header>
        <main class="workspace">
          <section class="canvas-panel">
            <div class="canvas-heading">
              <div>
                <h1>Pushdown Automaton Builder</h1>
                <p>Grid-snapped draggable states, editable transitions, JSON save/load, and standalone SVG export.</p>
              </div>
              <p class="canvas-meta">Canvas ${CANVAS_WIDTH} × ${CANVAS_HEIGHT}, grid ${GRID_SIZE}px</p>
            </div>
            <div class="canvas-frame">
              <div class="canvas-host"></div>
            </div>
            <p class="status-line"></p>
          </section>
          <aside class="inspector-panel">
            <div class="inspector-host"></div>
          </aside>
        </main>
        <input class="file-input" type="file" accept="application/json,.json" />
      </div>`

    this.canvasHost = this.root.querySelector<HTMLDivElement>('.canvas-host')!
    this.inspectorHost = this.root.querySelector<HTMLDivElement>('.inspector-host')!
    this.statusHost = this.root.querySelector<HTMLParagraphElement>('.status-line')!
    this.selectButton = this.root.querySelector<HTMLButtonElement>('[data-mode="select"]')!
    this.addStateButton = this.root.querySelector<HTMLButtonElement>('[data-mode="add-state"]')!
    this.connectButton = this.root.querySelector<HTMLButtonElement>('[data-mode="connect"]')!
    this.loadButton = this.root.querySelector<HTMLButtonElement>('[data-action="load"]')!
    this.saveButton = this.root.querySelector<HTMLButtonElement>('[data-action="save"]')!
    this.deleteButton = this.root.querySelector<HTMLButtonElement>('[data-action="delete"]')!
    this.exportButton = this.root.querySelector<HTMLButtonElement>('[data-action="export"]')!
    this.fileInput = this.root.querySelector<HTMLInputElement>('.file-input')!

    this.bindStaticEvents()
    this.render()
  }

  private bindStaticEvents(): void {
    this.selectButton.addEventListener('click', () => this.setMode('select'))
    this.addStateButton.addEventListener('click', () => this.setMode('add-state'))
    this.connectButton.addEventListener('click', () => this.setMode('connect'))
    this.loadButton.addEventListener('click', () => this.openJsonFilePicker())
    this.saveButton.addEventListener('click', () => this.saveJson())
    this.deleteButton.addEventListener('click', () => this.deleteSelection())
    this.exportButton.addEventListener('click', () => this.exportSvg())
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
        this.connectFromId = null
        this.setMode('select')
      }
    })
  }

  private setMode(mode: EditorMode): void {
    this.mode = mode

    if (mode !== 'connect') {
      this.connectFromId = null
    }

    this.render()
  }

  private render(): void {
    this.renderToolbar()
    this.renderCanvas()
    this.renderInspector()
    this.renderStatus()
  }

  private renderToolbar(): void {
    const modeButtons = [
      [this.selectButton, 'select'],
      [this.addStateButton, 'add-state'],
      [this.connectButton, 'connect'],
    ] as const

    for (const [button, mode] of modeButtons) {
      button.classList.toggle('is-active', this.mode === mode)
    }

    const hasSelection = this.selection !== null
    this.deleteButton.disabled = !hasSelection
    this.exportButton.disabled = this.states.length === 0
  }

  private renderCanvas(): void {
    this.canvasHost.innerHTML = buildSvgMarkup({
      states: this.states,
      transitions: this.transitions,
      selection: this.selection,
      connectFromId: this.connectFromId,
      showGrid: true,
      interactive: true,
    })

    const svg = this.canvasHost.querySelector<SVGSVGElement>('svg')

    if (!svg) {
      return
    }

    const hitbox = svg.querySelector<SVGRectElement>('[data-canvas-hitbox="true"]')
    hitbox?.addEventListener('click', (event) => this.handleCanvasClick(event, svg))

    for (const stateElement of svg.querySelectorAll<SVGGElement>('[data-state-id]')) {
      const stateId = stateElement.dataset.stateId

      if (!stateId) {
        continue
      }

      stateElement.addEventListener('click', (event) => this.handleStateClick(event, stateId))
      stateElement.addEventListener('mousedown', (event) => this.handleStateMouseDown(event, stateId, svg))
    }

    for (const transitionElement of svg.querySelectorAll<SVGGElement>('[data-transition-id]')) {
      const transitionId = transitionElement.dataset.transitionId

      if (!transitionId) {
        continue
      }

      transitionElement.addEventListener('click', (event) => {
        event.stopPropagation()
        this.selection = { type: 'transition', id: transitionId }
        this.render()
      })
    }
  }

  private renderInspector(): void {
    if (this.selection?.type === 'state') {
      const selection = this.selection
      const state = this.states.find(({ id }) => id === selection.id)

      if (!state) {
        this.selection = null
        this.renderInspector()
        return
      }

      this.inspectorHost.innerHTML = `
        <section class="inspector-section">
          <h2>State</h2>
          <label>
            <span>Label</span>
            <input type="text" name="label" value="${escapeAttribute(state.label)}" maxlength="12" />
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="start" ${state.isStart ? 'checked' : ''} />
            <span>Start state</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="accept" ${state.isAccept ? 'checked' : ''} />
            <span>Accept state</span>
          </label>
        </section>`

      const labelInput = this.inspectorHost.querySelector<HTMLInputElement>('input[name="label"]')!
      const startInput = this.inspectorHost.querySelector<HTMLInputElement>('input[name="start"]')!
      const acceptInput = this.inspectorHost.querySelector<HTMLInputElement>('input[name="accept"]')!

      labelInput.addEventListener('input', () => {
        state.label = labelInput.value.trim() || state.id
        this.clearNotice()
        this.renderCanvas()
        this.renderStatus()
      })

      startInput.addEventListener('change', () => {
        for (const item of this.states) {
          item.isStart = false
        }

        state.isStart = startInput.checked
        this.clearNotice()
        this.renderCanvas()
      })

      acceptInput.addEventListener('change', () => {
        state.isAccept = acceptInput.checked
        this.clearNotice()
        this.renderCanvas()
      })

      return
    }

    if (this.selection?.type === 'transition') {
      const selection = this.selection
      const transition = this.transitions.find(({ id }) => id === selection.id)

      if (!transition) {
        this.selection = null
        this.renderInspector()
        return
      }

      this.inspectorHost.innerHTML = `
        <section class="inspector-section">
          <h2>Transition</h2>
          <label>
            <span>Input</span>
            <input type="text" name="input" value="${escapeAttribute(transition.input)}" maxlength="2" />
          </label>
          <label>
            <span>Stack top</span>
            <input type="text" name="stackTop" value="${escapeAttribute(transition.stackTop)}" maxlength="2" />
          </label>
          <label>
            <span>Stack result</span>
            <input type="text" name="stackResult" value="${escapeAttribute(transition.stackResult)}" maxlength="2" />
          </label>
          <p class="inspector-help">Use one character or <code>${EPSILON_TOKEN}</code>. <code>$</code> is only valid in stack fields.</p>
          <div class="validation-list"></div>
        </section>`

      const inputField = this.inspectorHost.querySelector<HTMLInputElement>('input[name="input"]')!
      const stackTopField = this.inspectorHost.querySelector<HTMLInputElement>('input[name="stackTop"]')!
      const stackResultField = this.inspectorHost.querySelector<HTMLInputElement>('input[name="stackResult"]')!
      const validationHost = this.inspectorHost.querySelector<HTMLDivElement>('.validation-list')!

      const updateValidation = (): void => {
        const errors = validateTransition(transition)
        validationHost.innerHTML = errors.length === 0
          ? '<p class="validation-ok">Transition is valid.</p>'
          : errors.map((error) => `<p class="validation-error">${error}</p>`).join('')
      }

      const bindTransitionInput = (field: HTMLInputElement, key: 'input' | 'stackTop' | 'stackResult'): void => {
        field.addEventListener('input', () => {
          transition[key] = field.value.trim()
          this.clearNotice()
          this.renderCanvas()
          updateValidation()
        })
      }

      bindTransitionInput(inputField, 'input')
      bindTransitionInput(stackTopField, 'stackTop')
      bindTransitionInput(stackResultField, 'stackResult')
      updateValidation()

      return
    }

    this.inspectorHost.innerHTML = `
      <section class="inspector-section inspector-section--empty">
        <h2>Inspector</h2>
        <p>Select a state or transition to edit it.</p>
        <ul>
          <li>Add state mode places new states on the next grid snap.</li>
          <li>Connect mode creates transitions, including self-loops.</li>
          <li>Export SVG saves only the automaton, without the grid.</li>
          <li>Load and save JSON keep the automaton on disk.</li>
        </ul>
      </section>`
  }

  private renderStatus(): void {
    if (this.notice !== null) {
      this.statusHost.textContent = this.notice
      return
    }

    if (this.mode === 'add-state') {
      this.statusHost.textContent = 'Add state mode: click the canvas to place a new state on the grid.'
      return
    }

    if (this.mode === 'connect') {
      this.statusHost.textContent = this.connectFromId
        ? 'Connect mode: choose the target state to create a transition.'
        : 'Connect mode: choose the source state.'
      return
    }

    if (this.selection?.type === 'state') {
      const selection = this.selection
      const state = this.states.find(({ id }) => id === selection.id)
      this.statusHost.textContent = state
        ? `Selected state ${state.label}. Drag it to a new grid position.`
        : 'Select a state or transition.'
      return
    }

    if (this.selection?.type === 'transition') {
      this.statusHost.textContent = 'Selected transition. Edit its three single-symbol fields in the inspector.'
      return
    }

    this.statusHost.textContent = 'Select mode: drag states, edit the inspector, or switch to connect mode.'
  }

  private handleCanvasClick(event: MouseEvent, svg: SVGSVGElement): void {
    if (this.mode === 'add-state') {
      const point = this.clientToSvgPoint(event, svg)
      this.addState(point.x, point.y)
      return
    }

    if (this.mode === 'connect') {
      this.connectFromId = null
      this.render()
      return
    }

    this.selection = null
    this.render()
  }

  private handleStateClick(event: MouseEvent, stateId: string): void {
    event.stopPropagation()

    if (this.mode === 'connect') {
      if (this.connectFromId === null) {
        this.connectFromId = stateId
        this.selection = { type: 'state', id: stateId }
        this.render()
        return
      }

      const transitionId = this.createNextId('t', this.transitions.map(({ id }) => id), this.nextTransitionIndex)
      const transition = createTransition(transitionId, this.connectFromId, stateId)

      this.transitions = [...this.transitions, transition]
      this.nextTransitionIndex = this.parseTrailingNumber(transitionId, 't') + 1
      this.connectFromId = null
      this.selection = { type: 'transition', id: transition.id }
      this.clearNotice()
      this.render()
      return
    }

    this.selection = { type: 'state', id: stateId }
    this.render()
  }

  private handleStateMouseDown(event: MouseEvent, stateId: string, svg: SVGSVGElement): void {
    if (event.button !== 0 || this.mode !== 'select') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const state = this.states.find(({ id }) => id === stateId)

    if (!state) {
      return
    }

    const point = this.clientToSvgPoint(event, svg)

    this.selection = { type: 'state', id: stateId }
    this.dragState = {
      stateId,
      offsetX: point.x - state.x,
      offsetY: point.y - state.y,
    }

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

      this.states = this.states.map((item) =>
        item.id === this.dragState?.stateId ? { ...item, x: position.x, y: position.y } : item,
      )

      this.clearNotice()
      this.renderCanvas()
      this.renderStatus()
    }

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      this.dragState = null
      this.renderCanvas()
      this.renderStatus()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    this.renderCanvas()
    this.renderStatus()
  }

  private addState(x: number, y: number): void {
    const stateId = this.createNextId('q', this.states.map(({ id }) => id), this.nextStateIndex)
    const state = createState(stateId, stateId, x, y)

    this.nextStateIndex = this.parseTrailingNumber(stateId, 'q') + 1
    this.states = [...this.states, state]
    this.selection = { type: 'state', id: state.id }
    this.clearNotice()
    this.render()
  }

  private deleteSelection(): void {
    if (this.selection?.type === 'state') {
      const stateId = this.selection.id
      this.states = this.states.filter(({ id }) => id !== stateId)
      this.transitions = this.transitions.filter(
        ({ fromId, toId }) => fromId !== stateId && toId !== stateId,
      )

      if (this.connectFromId === stateId) {
        this.connectFromId = null
      }
    }

    if (this.selection?.type === 'transition') {
      const transitionId = this.selection.id
      this.transitions = this.transitions.filter(({ id }) => id !== transitionId)
    }

    this.selection = null
    this.clearNotice()
    this.render()
  }

  private saveJson(): void {
    downloadAutomatonJson(this.states, this.transitions)
    this.setNotice(`Saved ${this.states.length} states and ${this.transitions.length} transitions to JSON.`)
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
      this.states = document.states
      this.transitions = document.transitions
      this.selection = null
      this.connectFromId = null
      this.dragState = null
      this.mode = 'select'
      this.nextStateIndex = this.computeNextIndex(this.states.map(({ id }) => id), 'q')
      this.nextTransitionIndex = this.computeNextIndex(this.transitions.map(({ id }) => id), 't')
      this.setNotice(`Loaded ${document.states.length} states and ${document.transitions.length} transitions from ${file.name}.`)
      this.render()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load automaton file.'
      this.setNotice(message)
    }
  }

  private exportSvg(): void {
    if (this.states.length === 0) {
      return
    }

    downloadAutomatonSvg(this.states, this.transitions)
    this.setNotice('Exported automaton SVG without the editor grid.')
  }

  private setNotice(message: string): void {
    this.notice = message
    window.clearTimeout(this.noticeTimeout)
    this.noticeTimeout = window.setTimeout(() => {
      this.notice = null
      this.renderStatus()
    }, 4000)
    this.renderStatus()
  }

  private clearNotice(): void {
    this.notice = null
    window.clearTimeout(this.noticeTimeout)
  }

  private computeNextIndex(ids: string[], prefix: string): number {
    let highest = -1

    for (const id of ids) {
      if (!id.startsWith(prefix)) {
        continue
      }

      const suffix = Number(id.slice(prefix.length))

      if (Number.isInteger(suffix) && suffix >= 0) {
        highest = Math.max(highest, suffix)
      }
    }

    return highest + 1
  }

  private createNextId(prefix: string, existingIds: string[], startIndex: number): string {
    const usedIds = new Set(existingIds)
    let index = startIndex

    while (usedIds.has(`${prefix}${index}`)) {
      index += 1
    }

    return `${prefix}${index}`
  }

  private parseTrailingNumber(id: string, prefix: string): number {
    if (!id.startsWith(prefix)) {
      return 0
    }

    const suffix = Number(id.slice(prefix.length))
    return Number.isInteger(suffix) && suffix >= 0 ? suffix : 0
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
