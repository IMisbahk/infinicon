import { join } from "node:path"
import { bootstrapEnv } from "./bootstrap.ts"

const root = join(import.meta.dir, "..")

bootstrapEnv()

const port = process.env.PORT ?? "8787"
const baseUrl = process.env.INFINICON_BASE_URL ?? `http://localhost:${port}`

const waitForHealth = async (attempts = 40): Promise<void> => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {
      // server still booting
    }
    await Bun.sleep(150)
  }
  throw new Error(`memory server did not start at ${baseUrl}`)
}

console.log("infinicon — starting memory server + chat\n")

const server = Bun.spawn(["bun", "--env-file=.env", "run", "src/server.ts"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
})

const shutdown = (): void => {
  server.kill()
}

process.on("SIGINT", () => {
  shutdown()
  process.exit(0)
})

process.on("SIGTERM", () => {
  shutdown()
  process.exit(0)
})

try {
  await waitForHealth()
} catch (error) {
  shutdown()
  throw error
}

const chat = Bun.spawn(["bun", "--env-file=.env", "run", "examples/simple-chat.ts"], {
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
})

const code = await chat.exited
shutdown()
process.exit(code)
