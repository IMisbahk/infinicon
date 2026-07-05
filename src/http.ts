import { InfiniconSdkError, parseMemoryApiError } from "./errors"

type HttpMethod = "GET" | "POST"

type HttpRequestOptions = {
  method: HttpMethod
  path: string
  body?: unknown
  headers?: Record<string, string>
}

export type FetchLike = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>

export type HttpClientConfig = {
  baseUrl: string
  fetchImpl?: FetchLike
  apiKey?: string
  headers?: Record<string, string>
}

const ensureJsonHeaders = (headers?: Record<string, string>): Headers => {
  const merged = new Headers(headers)
  if (!merged.has("content-type")) merged.set("content-type", "application/json")
  if (!merged.has("accept")) merged.set("accept", "application/json")
  return merged
}

const parseJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const text = await response.text()
    if (!text.trim()) return {}
    return { message: text }
  }

  try {
    return await response.json()
  } catch {
    // damn broken payloads happen in early services
    return {}
  }
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly defaultHeaders: Record<string, string>

  public constructor(config: HttpClientConfig) {
    if (!config.baseUrl) {
      throw new InfiniconSdkError({
        code: "invalid_config",
        message: "baseUrl is required",
      })
    }

    this.baseUrl = config.baseUrl.endsWith("/")
      ? config.baseUrl.slice(0, -1)
      : config.baseUrl
    this.fetchImpl = config.fetchImpl ?? fetch
    this.defaultHeaders = {
      ...(config.headers ?? {}),
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    }
  }

  public async request<TResponse>(options: HttpRequestOptions): Promise<TResponse> {
    const init: RequestInit = {
      method: options.method,
      headers: ensureJsonHeaders({
        ...this.defaultHeaders,
        ...(options.headers ?? {}),
      }),
    }

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body)
    }

    const response = await this.fetchImpl(`${this.baseUrl}${options.path}`, init)

    const payload = await parseJson(response)

    if (!response.ok) {
      throw parseMemoryApiError(response.status, payload)
    }

    return payload as TResponse
  }
}
