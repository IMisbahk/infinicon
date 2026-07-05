export type AuthConfig = {
  apiKey?: string
}

export const authConfigFromEnv = (): AuthConfig => ({
  apiKey: process.env.INFINICON_API_KEY?.trim() || undefined,
})

export const authorizeRequest = (request: Request, config: AuthConfig = authConfigFromEnv()): Response | null => {
  if (!config.apiKey) return null

  const header = request.headers.get("authorization")
  const expected = `Bearer ${config.apiKey}`
  if (header === expected) return null

  return new Response(
    JSON.stringify({
      code: "unauthorized",
      message: "missing or invalid bearer token",
    }),
    {
      status: 401,
      headers: { "content-type": "application/json" },
    },
  )
}
