# Model registry

`latest.json` — pricing and context windows for models used by AI coding tools.

- **Source:** [OpenRouter models API](https://openrouter.ai/api/v1/models) (list prices match vendors' first-party pricing).
- **Refresh:** `.github/workflows/refresh-registry.yml` runs daily, runs `scripts/refresh-registry.mjs`, and commits only when data changed.
- **Corrections:** add them to `overrides.json` (merged last). Keep it small.

```jsonc
{
  "version": "2026-09-30",
  "lastUpdated": "2026-09-30T…Z",       // when the data last changed
  "modelCount": 212,
  "highlights": { "anthropic": { "sonnet": "claude-sonnet-5.5", … } },  // newest model per vendor + tier
  "models": {
    "claude-sonnet-5.5": {
      "id": "claude-sonnet-5.5", "name": "Claude Sonnet 5.5", "vendor": "anthropic",
      "family": "anthropic", "tier": "sonnet", "version": "5.5",
      "costPer1M": { "input": 2, "output": 10, "cacheRead": 0.2 },   // USD per million tokens
      "contextWindow": 1000000, "maxOutput": 128000,
      "released": "2026-09-28", "status": "active",                   // active | preview | deprecated
      "apiId": "claude-sonnet-5-5"
    }
  },
  "providerModels": { "claude": [ … ], "cursor": [ … ] }            // derived lineups per coding tool
}
```
