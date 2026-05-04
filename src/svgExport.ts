import { buildExportSvg } from './svgScene'
import type { StateNode, Transition } from './model'

export function downloadAutomatonSvg(states: StateNode[], transitions: Transition[]): void {
  const svg = buildExportSvg(states, transitions)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'pda.svg'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
