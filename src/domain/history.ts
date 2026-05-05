export interface HistoryState<T> {
  undo: T[]
  redo: T[]
}

export function createHistoryState<T>(): HistoryState<T> {
  return {
    undo: [],
    redo: [],
  }
}

export function pushHistoryEntry<T>(history: T[], entry: T, limit: number): T[] {
  return [...history, entry].slice(-limit)
}

export function commitHistory<T>(
  history: HistoryState<T>,
  previous: T,
  current: T,
  equals: (left: T, right: T) => boolean,
  limit: number,
): HistoryState<T> {
  if (equals(previous, current)) {
    return history
  }

  return {
    undo: pushHistoryEntry(history.undo, previous, limit),
    redo: [],
  }
}

export function takeUndoSnapshot<T>(history: HistoryState<T>, current: T, limit: number): {
  history: HistoryState<T>
  snapshot: T | null
} {
  const snapshot = history.undo.at(-1) ?? null

  if (snapshot === null) {
    return { history, snapshot: null }
  }

  return {
    snapshot,
    history: {
      undo: history.undo.slice(0, -1),
      redo: pushHistoryEntry(history.redo, current, limit),
    },
  }
}

export function takeRedoSnapshot<T>(history: HistoryState<T>, current: T, limit: number): {
  history: HistoryState<T>
  snapshot: T | null
} {
  const snapshot = history.redo.at(-1) ?? null

  if (snapshot === null) {
    return { history, snapshot: null }
  }

  return {
    snapshot,
    history: {
      undo: pushHistoryEntry(history.undo, current, limit),
      redo: history.redo.slice(0, -1),
    },
  }
}
