import type { IdFactory } from "./types"

export class IncrementingIdFactory implements IdFactory {
  private value = 0

  constructor(private readonly prefix = "ep") {}

  next(): string {
    this.value += 1
    return `${this.prefix}_${this.value}`
  }
}
