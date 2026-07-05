import { describe, expect, it } from "bun:test"

import { PluginHost, PluginHostError, pluginSpecVersionV0, type InfiniconPlugin } from "../src"

type RankerConfig = { deterministic: boolean }

type RankerInput = {
  query: string
  candidates: { id: string; baseScore: number }[]
}

type RankerOutput = {
  scores: { id: string; score: number }[]
}

const makeRankerPlugin = (): InfiniconPlugin<RankerConfig, RankerInput, RankerOutput> => ({
  descriptor: {
    name: "baseline-ranker",
    version: "1.0.0",
    kind: "ranker",
    supportedSpecVersion: pluginSpecVersionV0,
    configSchema: {
      type: "object",
      properties: {
        deterministic: { type: "boolean" },
      },
      required: ["deterministic"],
    },
    capabilities: ["scores_candidates"],
    sideEffects: "none",
    idempotencyGuarantees: "deterministic output when deterministic=true",
  },
  validateConfig(config: unknown) {
    if (!config || typeof config !== "object" || !("deterministic" in config)) {
      return {
        ok: false,
        issues: [{ field: "deterministic", message: "deterministic is required" }],
      }
    }

    if (typeof (config as { deterministic: unknown }).deterministic !== "boolean") {
      return {
        ok: false,
        issues: [{ field: "deterministic", message: "deterministic must be boolean" }],
      }
    }

    return { ok: true }
  },
  async run(input, _context, config) {
    return {
      scores: input.candidates.map((candidate) => ({
        id: candidate.id,
        score: config.deterministic ? candidate.baseScore : candidate.baseScore + 0.001,
      })),
    }
  },
})

describe("PluginHost", () => {
  it("registers plugin and lists by kind", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    const rankers = host.listByKind("ranker")
    expect(rankers).toHaveLength(1)
    expect(rankers[0]?.descriptor.name).toBe("baseline-ranker")
  })

  it("rejects duplicate plugin registration", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    expect(() => host.register({ plugin, config: { deterministic: true } })).toThrow(PluginHostError)
  })

  it("rejects unsupported spec version", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()
    plugin.descriptor.supportedSpecVersion = "v9"

    expect(() => host.register({ plugin, config: { deterministic: true } })).toThrow(PluginHostError)
  })

  it("runs registered plugin", async () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    const result = await host.run<RankerInput, RankerOutput>(
      "ranker",
      "baseline-ranker",
      "1.0.0",
      {
        query: "What did the user prefer",
        candidates: [
          { id: "a", baseScore: 0.9 },
          { id: "b", baseScore: 0.4 },
        ],
      },
      {
        scope: { tenantId: "t1", namespaceId: "n1" },
        requestId: "r1",
      },
    )

    expect(result.scores).toEqual([
      { id: "a", score: 0.9 },
      { id: "b", score: 0.4 },
    ])
  })

  it("fails on invalid config during registration", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    expect(() => host.register({ plugin, config: { deterministic: "yes" } as unknown as RankerConfig })).toThrow(
      PluginHostError,
    )
  })

  it("fails when plugin is not found", async () => {
    const host = new PluginHost(pluginSpecVersionV0)

    await expect(
      host.run<RankerInput, RankerOutput>(
        "ranker",
        "missing",
        "1.0.0",
        {
          query: "missing",
          candidates: [],
        },
        {
          scope: { tenantId: "t1", namespaceId: "n1" },
          requestId: "r2",
        },
      ),
    ).rejects.toThrow(PluginHostError)
  })

  it("returns a defensive list copy", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    const rankers = host.listByKind("ranker")
    expect(rankers).toHaveLength(1)

    const mutable = rankers as unknown as Array<unknown>
    mutable.length = 0

    expect(host.listByKind("ranker")).toHaveLength(1)
  })
})
