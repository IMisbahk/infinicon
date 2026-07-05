export type HttpHandler = {
  fetch: (request: Request) => Promise<Response> | Response
}

export const createServer = (): HttpHandler => {
  return {
    fetch: (request: Request) => {
      const { pathname } = new URL(request.url)

      if (pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ error: "not_implemented" }), {
        status: 501,
        headers: { "content-type": "application/json" },
      })
    },
  }
}
