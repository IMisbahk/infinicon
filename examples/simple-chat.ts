/**
 * Minimal agent: query memory → ask OpenAI → ingest the turn.
 * Uses examples/agent-chat/.env (same as agent-chat).
 *
 *   bun run example:simple
 */
import { InfiniconClient } from "@infinicon/sdk"
import * as readline from "readline/promises"

const baseUrl = process.env.INFINICON_BASE_URL ?? "http://localhost:8787"
const apiKey = process.env.INFINICON_API_KEY?.trim() || undefined
const openAiKey = process.env.OPENAI_API_KEY?.trim()
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"

const scope = {
  tenantId: process.env.INFINICON_TENANT_ID ?? "demo",
  namespaceId: process.env.INFINICON_NAMESPACE_ID ?? "agent-chat",
  ...(process.env.INFINICON_AGENT_ID ? { agentId: process.env.INFINICON_AGENT_ID } : {}),
}

const client = new InfiniconClient({
  baseUrl,
  ...(apiKey ? { apiKey } : {}),
})

const askOpenAi = async (system: string, user: string): Promise<string> => {
  if (!openAiKey) return `(no OPENAI_API_KEY) you said: ${user}`

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })

  const payload = (await response.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!response.ok) throw new Error(payload.error?.message ?? `openai ${response.status}`)
  return payload.choices?.[0]?.message?.content ?? "(empty reply)"
}

const pullMemory = async (query: string): Promise<string> => {
  const hits = await client.query({ scope, query, limit: 6 })
  if (hits.refs.length === 0) return "(none)"

  const hydrated = await client.hydrate({ scope, refs: hits.refs.map((row) => row.ref) })
  return hydrated.objects
    .map((object) => ("content" in object ? String(object.content) : JSON.stringify(object)))
    .join("\n")
}

const saveTurn = async (user: string, assistant: string): Promise<void> => {
  await client.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: user,
        createdBy: { id: "user", kind: "user" },
      },
      {
        contentType: "text/plain",
        content: assistant,
        createdBy: { id: "agent", kind: "agent" },
      },
    ],
  })
}

console.log("simple-chat — infinicon + openai")
console.log(`memory ${baseUrl} (${scope.tenantId}/${scope.namespaceId})\n`)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

while (true) {
  const userInput = (await rl.question("you> ")).trim()
  if (!userInput || userInput === "exit") break

  const memoryText = await pullMemory(userInput)
  const reply = await askOpenAi(
    `You are a helpful assistant. Prior memory from search:\n${memoryText}`,
    userInput,
  )

  console.log(`assistant> ${reply}\n`)
  await saveTurn(userInput, reply)
}

rl.close()
console.log("bye")
