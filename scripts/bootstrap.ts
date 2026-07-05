import { copyFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

export const bootstrapEnv = (): void => {
  const envPath = join(root, ".env")
  const examplePath = join(root, ".env.example")

  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath)
    console.log("infinicon: created .env from .env.example")
  }
}

if (import.meta.main) {
  bootstrapEnv()
}
