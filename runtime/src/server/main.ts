import { startRuntimeServer } from "./http-server"

const port = Number.parseInt(process.env.PORT ?? "3000", 10)
const server = startRuntimeServer(port)

console.log(`infinicon runtime server listening on :${server.port}`)
