/**
 * Minimal agent: query memory → ask OpenAI → ingest the turn.
 * Uses examples/agent-chat/.env (same as agent-chat).
 *
 *   bun run example:simple
 */
import { InfiniconClient, type MemoryRef } from "@infinicon/sdk"
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

const pullMemory = async (query: string): Promise<{ text: string; count: number }> => {
  const seen = new Set<string>()
  const refs: MemoryRef[] = []
  const plan = [
    query,
    ...query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4),
    // lexical miss on paraphrases — grab likely chat tokens from stored turns
    "im",
    "i",
    "you",
  ]

  for (const q of plan) {
    const hits = await client.query({ scope, query: q, limit: 6 })
    for (const row of hits.refs) {
      const key = `${row.ref.type}:${row.ref.id}`
      if (seen.has(key)) continue
      seen.add(key)
      refs.push(row.ref)
    }
    if (refs.length >= 8) break
  }

  if (refs.length === 0) return { text: "(none)", count: 0 }

  const hydrated = await client.hydrate({ scope, refs })
  const text = hydrated.objects
    .map((object) => ("content" in object ? String(object.content) : JSON.stringify(object)))
    .join("\n")
  return { text, count: hydrated.objects.length }
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

const askLine = async (rl: readline.Interface): Promise<string | null> => {
  try {
    return (await rl.question("you> ")).trim()
  } catch {
    return null
  }
}

console.log("simple-chat — infinicon + openai")
console.log(`memory ${baseUrl} (${scope.tenantId}/${scope.namespaceId})`)
console.log("exit to quit\n")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

process.on("SIGINT", () => {
  rl.close()
  console.log("\nbye")
  process.exit(0)
})

while (true) {
  const userInput = await askLine(rl)
  if (userInput === null) break
  if (!userInput || userInput === "exit" || userInput === "quit") break

  const memory = await pullMemory(userInput)
  console.log(`[memory: ${memory.count} hit(s)]`)

  const reply = await askOpenAi(
    [
      "You are a helpful assistant.",
      "Use prior memory below when it answers the question (names, preferences, facts).",
      "If memory has the answer, say it directly.",
      "",
      "Prior memory:",
      memory.text,
    ].join("\n"),
    userInput,
  )

  console.log(`assistant> ${reply}\n`)
  await saveTurn(userInput, reply)
}

rl.close()
console.log("bye")
