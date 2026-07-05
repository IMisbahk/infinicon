export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type LlmProvider = {
  name: string
  complete(messages: ChatMessage[]): Promise<string>
}

export const createOpenAiProvider = (options: {
  apiKey: string
  model: string
  baseUrl: string
}): LlmProvider => ({
  name: `openai:${options.model}`,
  async complete(messages) {
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: 0.4,
      }),
    })

    const payload = (await response.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `openai request failed (${response.status})`)
    }

    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error("openai returned empty completion")
    return content
  },
})

export const createLocalEchoProvider = (): LlmProvider => ({
  name: "local-echo",
  async complete(messages) {
    const lastUser = [...messages].reverse().find((message) => message.role === "user")
    const memoryBlock = messages.find((message) => message.role === "system")?.content ?? ""
    const snippet = memoryBlock.includes("[memory")
      ? "I found related memory and used it."
      : "No related memory was retrieved."

    return `(${snippet}) You said: ${lastUser?.content ?? "(nothing)"}`
  },
})
