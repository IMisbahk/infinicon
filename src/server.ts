import { createServer } from "./transport/httpServer"

const port = Number(process.env.PORT ?? 8787)
const hostname = process.env.HOST ?? "0.0.0.0"

const server = await createServer()
server.startBackgroundJobs?.()

console.log(`infinicon server listening on ${hostname}:${port}`)

Bun.serve({
  port,
  hostname,
  fetch: server.fetch,
})
