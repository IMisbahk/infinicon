import { createServer } from "./transport/httpServer"

const port = Number(process.env.PORT ?? 8787)
const server = createServer()

console.log(`infinicon server listening on :${port}`)

Bun.serve({
  port,
  fetch: server.fetch,
})
