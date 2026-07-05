export class InfiniconClient {
  constructor({ baseUrl, headers = {} }) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    this.headers = {
      "content-type": "application/json",
      ...headers,
    }
  }

  async #post(path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    if (!response.ok) {
      const error = new Error(payload?.error?.message ?? "request failed")
      error.code = payload?.error?.code ?? "request_failed"
      error.details = payload?.error?.details ?? {}
      throw error
    }
    return payload
  }

  async ingest(request) {
    return this.#post("/v0/ingest", request)
  }

  async query(request) {
    return this.#post("/v0/query", request)
  }

  async hydrate(request) {
    return this.#post("/v0/hydrate", request)
  }

  async assembleContext(request) {
    return this.#post("/v0/assemble-context", request)
  }

  async consolidate(request) {
    return this.#post("/v0/consolidate", request)
  }

  async tombstone(request) {
    return this.#post("/v0/tombstone", request)
  }

  async getJob(request) {
    return this.#post("/v0/get-job", request)
  }

  async subscribe(request) {
    return this.#post("/v0/subscribe", request)
  }
}
