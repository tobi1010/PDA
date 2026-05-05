import { buildSvgMarkup } from '../infrastructure/svgScene'
import { type Selection, type StateNode, type Transition } from '../domain/editorTypes'

export function renderCanvasView(
  host: HTMLDivElement,
  model: {
    states: StateNode[]
    transitions: Transition[]
    selection: Selection
    connectFromId: string | null
    runStateIds: string[]
  },
  handlers: {
    onCanvasClick: (event: MouseEvent, svg: SVGSVGElement) => void
    onStateClick: (event: MouseEvent, stateId: string) => void
    onStateMouseDown: (event: MouseEvent, stateId: string, svg: SVGSVGElement) => void
    onTransitionClick: (event: MouseEvent, transitionId: string) => void
  },
): void {
  host.innerHTML = buildSvgMarkup({
    states: model.states,
    transitions: model.transitions,
    selection: model.selection,
    connectFromId: model.connectFromId,
    runStateIds: model.runStateIds,
    showGrid: true,
    interactive: true,
  })

  const svg = host.querySelector<SVGSVGElement>('svg')

  if (!svg) {
    return
  }

  const hitbox = svg.querySelector<SVGRectElement>('[data-canvas-hitbox="true"]')
  hitbox?.addEventListener('click', (event) => handlers.onCanvasClick(event, svg))

  for (const stateElement of svg.querySelectorAll<SVGGElement>('[data-state-id]')) {
    const stateId = stateElement.dataset.stateId

    if (!stateId) {
      continue
    }

    stateElement.addEventListener('click', (event) => handlers.onStateClick(event, stateId))
    stateElement.addEventListener('mousedown', (event) => handlers.onStateMouseDown(event, stateId, svg))
  }

  for (const transitionElement of svg.querySelectorAll<SVGGElement>('[data-transition-id]')) {
    const transitionId = transitionElement.dataset.transitionId

    if (!transitionId) {
      continue
    }

    transitionElement.addEventListener('click', (event) => handlers.onTransitionClick(event, transitionId))
  }
}
