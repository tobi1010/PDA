import { buildTransitionGeometries, measureSceneBounds, type Bounds } from './geometry'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  STATE_RADIUS,
  formatTransitionLabel,
  type Selection,
  type StateNode,
  type Transition,
  validateTransition,
} from './model'

interface SvgSceneOptions {
  states: StateNode[]
  transitions: Transition[]
  selection: Selection
  connectFromId: string | null
  runStateId: string | null
  showGrid: boolean
  interactive: boolean
  viewBox?: string
  bounds?: Bounds
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function markerDefinitions(showGrid: boolean): string {
  const gridDefinition = showGrid
    ? `
      <pattern id="editor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(120, 136, 161, 0.18)" stroke-width="1" />
      </pattern>`
    : ''

  return `
    <defs>
      ${gridDefinition}
      <marker id="edge-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
        <path d="M 0 0 L 12 6 L 0 12 z" fill="#334155" />
      </marker>
      <marker id="start-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
        <path d="M 0 0 L 12 6 L 0 12 z" fill="#475569" />
      </marker>
    </defs>`
}

function renderState(
  state: StateNode,
  selection: Selection,
  connectFromId: string | null,
  runStateId: string | null,
  interactive: boolean,
): string {
  const selected = selection?.type === 'state' && selection.id === state.id
  const connectSource = connectFromId === state.id
  const isRunningState = runStateId === state.id
  const classes = ['state-node']

  if (selected) {
    classes.push('is-selected')
  }

  if (connectSource) {
    classes.push('is-connect-source')
  }

  if (isRunningState) {
    classes.push('is-run-current')
  }

  const startArrow = state.isStart
    ? `<path class="start-arrow" d="M ${state.x - STATE_RADIUS - 48} ${state.y} L ${state.x - STATE_RADIUS - 8} ${state.y}" marker-end="url(#start-arrow)" />`
    : ''

  const innerCircle = state.isAccept
    ? `<circle class="state-accept" cx="${state.x}" cy="${state.y}" r="${STATE_RADIUS - 6}" />`
    : ''

  const dataAttribute = interactive ? `data-state-id="${state.id}"` : ''

  return `
    <g class="${classes.join(' ')}" ${dataAttribute}>
      ${startArrow}
      <circle class="state-circle" cx="${state.x}" cy="${state.y}" r="${STATE_RADIUS}" />
      ${innerCircle}
      <text class="state-label" x="${state.x}" y="${state.y + 5}" text-anchor="middle">${escapeXml(state.label)}</text>
    </g>`
}

function renderTransition(
  transition: Transition,
  selection: Selection,
  interactive: boolean,
  path: string,
  labelX: number,
  labelY: number,
  labelWidth: number,
): string {
  const selected = selection?.type === 'transition' && selection.id === transition.id
  const invalid = validateTransition(transition).length > 0
  const classes = ['transition-edge']

  if (selected) {
    classes.push('is-selected')
  }

  if (invalid) {
    classes.push('is-invalid')
  }

  const label = formatTransitionLabel(transition)
  const dataAttribute = interactive ? `data-transition-id="${transition.id}"` : ''
  const hitPath = interactive ? `<path class="transition-hit" d="${path}" />` : ''

  return `
    <g class="${classes.join(' ')}" ${dataAttribute}>
      ${hitPath}
      <path class="transition-path" d="${path}" marker-end="url(#edge-arrow)" />
      <rect class="transition-label-bg" x="${labelX - labelWidth / 2}" y="${labelY - 14}" width="${labelWidth}" height="22" rx="8" ry="8" />
      <text class="transition-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeXml(label)}</text>
    </g>`
}

export function buildSvgMarkup(options: SvgSceneOptions): string {
  const viewBox = options.viewBox ?? `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`
  const geometryMap = buildTransitionGeometries(options.states, options.transitions, formatTransitionLabel)
  const contentBounds = options.bounds ?? measureSceneBounds(options.states, geometryMap.values())
  const width = contentBounds.maxX - contentBounds.minX
  const height = contentBounds.maxY - contentBounds.minY
  const emptyState = options.states.length === 0
    ? `<text class="empty-canvas" x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT / 2}" text-anchor="middle">Add a state, then connect states to build a PDA.</text>`
    : ''

  const gridLayer = options.showGrid
    ? `<rect class="canvas-grid" x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#editor-grid)" />`
    : ''

  const transitionLayer = options.transitions
    .map((transition) => {
      const geometry = geometryMap.get(transition.id)

      if (!geometry) {
        return ''
      }

      return renderTransition(
        transition,
        options.selection,
        options.interactive,
        geometry.path,
        geometry.labelX,
        geometry.labelY,
        geometry.labelWidth,
      )
    })
    .join('')

  const stateLayer = options.states
    .map((state) => renderState(state, options.selection, options.connectFromId, options.runStateId, options.interactive))
    .join('')

  return `
    <svg
      class="editor-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox}"
      width="${Math.max(width, 1)}"
      height="${Math.max(height, 1)}"
      aria-label="Pushdown automaton editor"
    >
      ${markerDefinitions(options.showGrid)}
      ${gridLayer}
      ${options.interactive ? `<rect class="canvas-hitbox" data-canvas-hitbox="true" x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" />` : ''}
      <g class="scene-layer">
        ${transitionLayer}
        ${stateLayer}
        ${emptyState}
      </g>
    </svg>`
}

export function buildExportSvg(states: StateNode[], transitions: Transition[]): string {
  const geometryMap = buildTransitionGeometries(states, transitions, formatTransitionLabel)
  const bounds = measureSceneBounds(states, geometryMap.values())
  const padding = 56
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.maxX - bounds.minX + padding * 2} ${bounds.maxY - bounds.minY + padding * 2}`

  return buildSvgMarkup({
    states,
    transitions,
    selection: null,
    connectFromId: null,
    runStateId: null,
    showGrid: false,
    interactive: false,
    viewBox,
    bounds: {
      minX: bounds.minX - padding,
      minY: bounds.minY - padding,
      maxX: bounds.maxX + padding,
      maxY: bounds.maxY + padding,
    },
  })
    .replace('<svg', '<svg role="img"')
    .replace(
      '</svg>',
      `<style>
        .state-circle,.state-accept{fill:#fff;stroke:#0f172a;stroke-width:2.5}
        .state-label,.transition-label{font-family:Inter,system-ui,sans-serif;font-size:15px;fill:#0f172a}
        .start-arrow,.transition-path{fill:none;stroke:#334155;stroke-width:2.5}
        .transition-hit{fill:none;stroke:none}
        .transition-label-bg{fill:rgba(255,255,255,.92);stroke:#cbd5e1;stroke-width:1}
      </style></svg>`,
    )
}
