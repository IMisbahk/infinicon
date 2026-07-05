let nextId = 0

export const createId = (prefix: string): string => {
  nextId += 1
  return `${prefix}_${Date.now()}_${nextId}`
}
