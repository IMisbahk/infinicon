#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const serverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "server.js")
const result = spawnSync("bun", [serverPath], { stdio: "inherit", env: process.env })

if (result.error?.code === "ENOENT") {
  console.error("infinicon-server requires Bun — install from https://bun.sh")
  process.exit(1)
}

process.exit(result.status ?? 1)
