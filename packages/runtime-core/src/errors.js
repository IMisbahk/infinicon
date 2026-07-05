export class MemoryApiRuntimeError extends Error {
  constructor(code, message, retryable = false, details = {}) {
    super(message)
    this.name = "MemoryApiRuntimeError"
    this.code = code
    this.retryable = retryable
    this.details = details
  }

  toResponseError() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    }
  }
}
