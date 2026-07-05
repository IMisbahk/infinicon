import { InfiniconClient } from "@infinicon/sdk"
import { loadConfig } from "./config"
import { MemorySession } from "./memorySession"
import { createLocalEchoProvider, createOpenAiProvider, type LlmProvider } from "./llmProvider"

const config = loadConfig()

const client = new InfiniconClient({
  baseUrl: config.infiniconBaseUrl,
  ...(config.infiniconApiKey ? { apiKey: config.infiniconApiKey } : {}),
})

const scope = {
  tenantId: config.tenantId,
  namespaceId: config.namespaceId,
  agentId: config.agentId,
  ...(config.sessionId ? { sessionId: config.sessionId } : {}),
}

const memory = new MemorySession({
  client,
  scope,
  agentId: config.agentId,
  contextMaxTokens: config.contextMaxTokens,
  consolidateEveryTurns: config.consolidateEveryTurns,
})

const llm: LlmProvider = config.openAiApiKey
  ? createOpenAiProvider({
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      baseUrl: config.openAiBaseUrl,
    })
  : createLocalEchoProvider()

const pingHealth = async (): Promise<void> => {
  const response = await fetch(`${config.infiniconBaseUrl}/health`)
  if (!response.ok) throw new Error(`infinicon health check failed (${response.status})`)
}

const runChatLoop = async (): Promise<void> => {
  console.log("infinicon agent-chat")
  console.log(`memory: ${config.infiniconBaseUrl} (${scope.tenantId}/${scope.namespaceId})`)
  console.log(`llm: ${llm.name}`)
  console.log("type a message, or 'exit' to quit\n")

  const stdin = Bun.stdin.stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    process.stdout.write("you> ")
    buffer = ""

    while (true) {
      const { value, done } = await stdin.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      if (buffer.includes("\n")) break
    }

    const userInput = buffer.trim()
    if (!userInput) continue
    if (userInput === "exit" || userInput === "quit") {
      console.log("bye")
      return
    }

    const recalled = await memory.recallForTask(userInput)
    const memoryBlock = memory.formatContextBlock(recalled.segments)

    console.log(
      `[memory: ${recalled.segments.length} segment(s) from ${recalled.refCount} ref(s); tried: ${recalled.queriesTried.join(" | ")}]`,
    )

    if (recalled.warnings.length > 0) {
      const codes = recalled.warnings.map((warning) => warning.code).join(", ")
      console.log(`[memory warnings: ${codes}]`)
    }

    const reply = await llm.complete([
      {
        role: "system",
        content: [
          "You are a helpful assistant with access to long-term memory.",
          "Use retrieved memory when relevant. If memory is empty, say you do not recall prior context.",
          "",
          "Retrieved memory:",
          memoryBlock,
        ].join("\n"),
      },
      { role: "user", content: userInput },
    ])

    console.log(`assistant> ${reply}\n`)

    await memory.rememberUserMessage(userInput)
    await memory.rememberAssistantMessage(reply)
    await memory.completeTurn()
  }
}

await pingHealth()
await runChatLoop()
