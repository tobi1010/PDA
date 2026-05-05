export type EditorMode = 'select' | 'add-state' | 'connect'

export interface StateNode {
  id: string
  label: string
  x: number
  y: number
  isStart: boolean
  isAccept: boolean
}

export interface Transition {
  id: string
  fromId: string
  toId: string
  input: string
  stackTop: string
  stackResult: string
}

export type Selection =
  | { type: 'state'; id: string }
  | { type: 'transition'; id: string }
  | null
