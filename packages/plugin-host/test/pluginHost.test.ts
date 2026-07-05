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

  it("reports stats and has status", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    expect(host.has("ranker", "baseline-ranker", "1.0.0")).toBe(true)
    expect(host.stats()).toEqual({
      totalRegisteredPlugins: 1,
      registeredByKind: {
        extractor: 0,
        embedder: 0,
        ranker: 1,
        consolidator: 0,
        formatter: 0,
        storage_adapter: 0,
      },
    })
  })

  it("unregisters plugin", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })
    expect(host.unregister("ranker", "baseline-ranker", "1.0.0")).toBe(true)
    expect(host.has("ranker", "baseline-ranker", "1.0.0")).toBe(false)
    expect(host.stats().totalRegisteredPlugins).toBe(0)
  })

  it("emits lifecycle events", async () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()
    const events: string[] = []

    const subscription = host.subscribe((event) => {
      events.push(event.type)
    })

    host.register({ plugin, config: { deterministic: true } })
    await host.run<RankerInput, RankerOutput>(
      "ranker",
      "baseline-ranker",
      "1.0.0",
      {
        query: "events",
        candidates: [{ id: "a", baseScore: 1 }],
      },
      {
        scope: { tenantId: "t1", namespaceId: "n1" },
        requestId: "r3",
      },
    )
    host.unregister("ranker", "baseline-ranker", "1.0.0")

    subscription.unsubscribe()

    expect(events).toEqual(["plugin_registered", "plugin_executed", "plugin_unregistered"])
  })

  it("provides readonly host view", () => {
    const host = new PluginHost(pluginSpecVersionV0)
    const plugin = makeRankerPlugin()

    host.register({ plugin, config: { deterministic: true } })

    const readonlyView = host.asReadonly()
    expect(readonlyView.specVersion).toBe(pluginSpecVersionV0)
    expect(readonlyView.has("ranker", "baseline-ranker", "1.0.0")).toBe(true)
    expect(readonlyView.stats().totalRegisteredPlugins).toBe(1)
  })

  it("registers multiple plugins", () => {
    const host = new PluginHost(pluginSpecVersionV0)

    host.registerMany([
      { plugin: makeRankerPlugin(), config: { deterministic: true } },
      {
        plugin: {
          ...makeRankerPlugin(),
          descriptor: {
            ...makeRankerPlugin().descriptor,
            name: "baseline-ranker-2",
          },
        },
        config: { deterministic: true },
      },
    ])

    expect(host.stats().totalRegisteredPlugins).toBe(2)
    expect(host.has("ranker", "baseline-ranker", "1.0.0")).toBe(true)
    expect(host.has("ranker", "baseline-ranker-2", "1.0.0")).toBe(true)
  })

  it("clears all plugins", () => {
    const host = new PluginHost(pluginSpecVersionV0)

    host.register({ plugin: makeRankerPlugin(), config: { deterministic: true } })
    host.clear()

    expect(host.stats().totalRegisteredPlugins).toBe(0)
    expect(host.listByKind("ranker")).toHaveLength(0)
  })

  it("handles listener errors without failing host operations", () => {
    const listenerErrors: unknown[] = []
    const host = new PluginHost(pluginSpecVersionV0, {
      onEventListenerError: (error) => {
        listenerErrors.push(error)
      },
    })

    host.subscribe(() => {
      throw new Error("listener boom")
    })

    host.register({ plugin: makeRankerPlugin(), config: { deterministic: true } })

    expect(host.has("ranker", "baseline-ranker", "1.0.0")).toBe(true)
    expect(listenerErrors).toHaveLength(1)
  })
})
