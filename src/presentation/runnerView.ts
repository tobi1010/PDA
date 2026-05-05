import { displayToken } from '../domain/automaton'
import { type StateNode } from '../domain/editorTypes'
import { type SimulationResult, type SimulationStepConfiguration } from '../simulator'

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function displayWord(word: string): string {
  return word.length === 0 ? 'ε' : word
}

function sliceWordSymbols(word: string, start: number, end?: number): string {
  return Array.from(word).slice(start, end).join('')
}

function getStateLabel(states: StateNode[], stateId: string): string {
  return states.find((state) => state.id === stateId)?.label ?? stateId
}

function formatStateSet(states: StateNode[], stateIds: string[]): string {
  if (stateIds.length === 0) {
    return '∅'
  }

  return `{${stateIds.map((stateId) => getStateLabel(states, stateId)).join(', ')}}`
}

function renderRunnerStacks(states: StateNode[], configurations: SimulationStepConfiguration[]): string {
  if (configurations.length === 0) {
    return '<p class="runner-result-meta">No active configurations remain in this frontier.</p>'
  }

  const groups = new Map<string, { symbols: string[]; count: number; stateLabels: string[] }>()

  for (const configuration of configurations) {
    const key = configuration.stack.join('\u0001')
    const stateLabel = getStateLabel(states, configuration.stateId)
    const group = groups.get(key)

    if (group) {
      group.count += 1

      if (!group.stateLabels.includes(stateLabel)) {
        group.stateLabels.push(stateLabel)
      }

      continue
    }

    groups.set(key, {
      symbols: [...configuration.stack],
      count: 1,
      stateLabels: [stateLabel],
    })
  }

  const cards = [...groups.values()]
    .sort((left, right) => right.symbols.length - left.symbols.length || right.count - left.count)
    .map((group) => {
      const stateFooter = group.stateLabels
        .sort((left, right) => left.localeCompare(right))
        .map((label) => escapeAttribute(label))
        .join(', ')
      const stackSymbols = group.symbols.length === 0
        ? '<div class="runner-stack-symbol runner-stack-symbol--empty">ε</div>'
        : group.symbols
            .slice()
            .reverse()
            .map((symbol, index) => {
              const symbolClasses = index === 0
                ? 'runner-stack-symbol runner-stack-symbol--top'
                : 'runner-stack-symbol'

              return `<div class="${symbolClasses}">${escapeAttribute(displayToken(symbol))}</div>`
            })
            .join('')

      return `
        <article class="runner-stack-card">
          <div class="runner-stack-card-header">
            <span class="runner-stack-card-title">Stack</span>
            <span class="runner-stack-card-count">×${group.count}</span>
          </div>
          <div class="runner-stack-symbols">${stackSymbols}</div>
          <p class="runner-stack-footer">${stateFooter}</p>
        </article>`
    })
    .join('')

  return `<div class="runner-stack-grid">${cards}</div>`
}

export function renderRunnerView(
  host: HTMLDivElement,
  input: HTMLInputElement,
  model: {
    word: string
    result: SimulationResult | null
    stepIndex: number
    states: StateNode[]
  },
): void {
  input.value = model.word

  if (model.result === null) {
    host.className = 'runner-result runner-result--idle'
    host.innerHTML = '<p>Enter a word and choose <strong>Run full</strong> or <strong>Step</strong>. Empty input is treated as ε.</p>'
    return
  }

  const statusClass = `runner-result runner-result--${model.result.status}`
  const baseLine = `<p class="runner-result-title">${model.result.message}</p>`
  const summaryLine = `<p class="runner-result-meta">Input: <code>${escapeAttribute(displayWord(model.word))}</code> · Explored configurations: ${model.result.explored}</p>`
  const step = model.stepIndex >= 0 ? model.result.steps[model.stepIndex] ?? null : null

  if (!step) {
    host.className = statusClass
    host.innerHTML = `${baseLine}${summaryLine}`
    return
  }

  const consumed = displayWord(sliceWordSymbols(model.word, 0, step.inputIndex))
  const remaining = displayWord(sliceWordSymbols(model.word, step.inputIndex))
  const stateSet = formatStateSet(model.states, step.activeStateIds)
  const stackMarkup = renderRunnerStacks(model.states, step.configurations)

  host.className = statusClass
  host.innerHTML = `
    ${baseLine}
    ${summaryLine}
    <div class="runner-step-summary">
      <p class="runner-result-meta">Step <strong>${model.stepIndex + 1}/${model.result.steps.length}</strong></p>
      <p class="runner-result-meta">States <code>${escapeAttribute(stateSet)}</code></p>
      <p class="runner-result-meta">Configurations <strong>${step.configurations.length}</strong></p>
      <p class="runner-result-meta">Consumed <code>${escapeAttribute(consumed)}</code> · Remaining <code>${escapeAttribute(remaining)}</code></p>
    </div>
    ${stackMarkup}`
}
