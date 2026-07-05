import type { MemoryApiError } from "./types"

export class InfiniconSdkError extends Error {
  public readonly code: string
  public readonly status: number | undefined
  public readonly retryable: boolean | undefined
  public readonly details: Record<string, unknown> | undefined

  public constructor(params: {
    code: string
    message: string
    status?: number
    retryable?: boolean
    details?: Record<string, unknown>
  }) {
    super(params.message)
    this.name = "InfiniconSdkError"
    this.code = params.code
    this.status = params.status
    this.retryable = params.retryable
    this.details = params.details
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

export const parseMemoryApiError = (
  status: number,
  payload: unknown,
): InfiniconSdkError => {
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error as Partial<MemoryApiError> & {
      status?: number
    }

    const retryable =
      typeof error.retryable === "boolean" ? error.retryable : undefined
    const details = isRecord(error.details) ? error.details : undefined

    return new InfiniconSdkError({
      code: typeof error.code === "string" ? error.code : "api_error",
      message: typeof error.message === "string" ? error.message : "API error",
      status,
      ...(retryable !== undefined ? { retryable } : {}),
      ...(details !== undefined ? { details } : {}),
    })
  }

  if (isRecord(payload)) {
    const code = typeof payload.code === "string" ? payload.code : "http_error"
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `HTTP request failed with status ${status}`

    return new InfiniconSdkError({
      code,
      message,
      status,
      details: payload,
    })
  }

  return new InfiniconSdkError({
    code: "http_error",
    message: `HTTP request failed with status ${status}`,
    status,
  })
}
