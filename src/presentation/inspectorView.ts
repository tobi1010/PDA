import { type StateNode, type Transition } from '../domain/editorTypes'
import { validateTransition } from '../domain/transitionValidation'

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function renderStateInspector(
  host: HTMLDivElement,
  state: StateNode,
  handlers: {
    onLabelChange: (value: string) => void
    onStartChange: (checked: boolean) => void
    onAcceptChange: (checked: boolean) => void
  },
): void {
  host.innerHTML = `
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

  const labelInput = host.querySelector<HTMLInputElement>('input[name="label"]')!
  const startInput = host.querySelector<HTMLInputElement>('input[name="start"]')!
  const acceptInput = host.querySelector<HTMLInputElement>('input[name="accept"]')!

  labelInput.addEventListener('input', () => handlers.onLabelChange(labelInput.value))
  startInput.addEventListener('change', () => handlers.onStartChange(startInput.checked))
  acceptInput.addEventListener('change', () => handlers.onAcceptChange(acceptInput.checked))
}

export function renderTransitionInspector(
  host: HTMLDivElement,
  transition: Transition,
  epsilonToken: string,
  handlers: {
    onFieldChange: (key: 'input' | 'stackTop' | 'stackResult', value: string) => void
  },
): void {
  host.innerHTML = `
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
      <p class="inspector-help">Use one character or <code>${epsilonToken}</code>. <code>$</code> is only valid in stack fields.</p>
      <div class="validation-list"></div>
    </section>`

  const validationHost = host.querySelector<HTMLDivElement>('.validation-list')!

  const updateValidation = (): void => {
    const errors = validateTransition(transition)
    validationHost.innerHTML = errors.length === 0
      ? '<p class="validation-ok">Transition is valid.</p>'
      : errors.map((error) => `<p class="validation-error">${error}</p>`).join('')
  }

  for (const [selector, key] of [
    ['input[name="input"]', 'input'],
    ['input[name="stackTop"]', 'stackTop'],
    ['input[name="stackResult"]', 'stackResult'],
  ] as const) {
    const input = host.querySelector<HTMLInputElement>(selector)!
    input.addEventListener('input', () => {
      handlers.onFieldChange(key, input.value)
      updateValidation()
    })
  }

  updateValidation()
}

export function renderEmptyInspector(host: HTMLDivElement): void {
  host.innerHTML = `
    <section class="inspector-section inspector-section--empty">
      <h2>Inspector</h2>
      <p>Select a state or transition to edit it.</p>
      <ul>
        <li>Add state mode places new states on the next grid snap.</li>
        <li>Connect mode creates transitions, including self-loops.</li>
        <li>Run full checks acceptance for the current word.</li>
        <li>Step advances the active frontier one input symbol at a time.</li>
        <li>Export SVG saves only the automaton, without the grid.</li>
        <li>Load and save JSON keep the automaton on disk.</li>
      </ul>
    </section>`
}
