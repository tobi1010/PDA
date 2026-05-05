export function computeNextIndex(ids: string[], prefix: string): number {
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

export function createNextId(prefix: string, existingIds: string[], startIndex: number): string {
  const usedIds = new Set(existingIds)
  let index = startIndex

  while (usedIds.has(`${prefix}${index}`)) {
    index += 1
  }

  return `${prefix}${index}`
}

export function parseTrailingNumber(id: string, prefix: string): number {
  if (!id.startsWith(prefix)) {
    return 0
  }

  const suffix = Number(id.slice(prefix.length))
  return Number.isInteger(suffix) && suffix >= 0 ? suffix : 0
}
