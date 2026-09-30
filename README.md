# Cortex

**Think before you prompt.**

Cortex is the planning lab you use *before* Claude, ChatGPT or Cursor write a line of code. It makes you clear about what you're building, who it's for, why it wins and how big it has to get. It helps you choose a stack you actually understand, then shows you the architecture, the repository skeleton, the running cost and what to learn. You leave with **phased prompts** and **AI rules** that keep every coding agent on your plan.

🌐 **[cortex1.vercel.app](https://cortex1.vercel.app/)** — open the Lab · 🎓 [Academy](https://cortex1.vercel.app/academy.html) · 💸 [Models & cost](https://cortex1.vercel.app/models.html) · ⚙️ [Compiler](https://cortex1.vercel.app/compiler.html) · 📚 [Docs](https://cortex1.vercel.app/docs.html)

[![CI](https://github.com/Phani3108/Cortex/actions/workflows/ci.yml/badge.svg)](https://github.com/Phani3108/Cortex/actions/workflows/ci.yml)
[![Model data](https://github.com/Phani3108/Cortex/actions/workflows/refresh-registry.yml/badge.svg)](https://github.com/Phani3108/Cortex/actions/workflows/refresh-registry.yml)

## The Lab: four doors, one destination

| You are… | Door | You answer |
|---|---|---|
| Just exploring | **Pick my stack** | Choose technologies; see what each is good for and what you could build |
| Looking for direction | **Guide me** | Your idea + 4 questions → a proven starter stack with reasons |
| Serious about the build | **Architect my project** | Problem, users, edge, 90-day target, then scale, data, auth, infra, skills, compliance |
| Extending a product | **Existing product** | The feature, what must not break, your current stack |

Every door ends in the same **build pack**:

```
Clarity score (gaps named) → Stack & trade-offs → Architecture → Skeleton → Cost (infra + live AI prices)
   → What to learn (docs + channels) → Phased prompts (locked until you're clear) → AI rules → Compiler
```

The prompts stay locked until the plan is clear enough, because every vague prompt makes an AI tool guess, and you pay for each guess in tokens, rework and a product with no point.

## The compiler: keep every AI tool on the plan

Your plan's rules (vision, stack, guardrails) live in `.cortex/`. The Cortex CLI compiles them into the native instruction files of Claude Code, Codex (AGENTS.md), Cursor, GitHub Copilot, Gemini CLI, Windsurf / Devin Desktop, Kiro and Antigravity. Each output is formatted for its model family, fitted to that tool's limits, and checked for drift in CI.

## Why a compiler

- Every tool reads a different file, in a different format, with different limits — and the copies drift.
- Windsurf cuts rule files at 12,000 characters, Antigravity at 24 KB, Codex reads 32 KiB of AGENTS.md. Nobody tells you what got cut.
- Tools that read AGENTS.md *and* their own rules file load your rules twice.

Cortex treats AI context like source code: one source, compiled to targets, verified in CI.

## Install

```bash
npm install -g github:Phani3108/Cortex   # Node 20+
cortex --version
```

No dependencies. Everything runs locally; only `cortex update` (model data) and `cortex sync` (sources you list) touch the network.

## Quick start

```bash
cd your-repo
cortex init              # detects your stack + the AI tools you use, imports existing CLAUDE.md / AGENTS.md / .cursor/rules …
$EDITOR .cortex/rules/project.md
cortex compile           # writes native files for every enabled tool
cortex compile --check   # in CI: exit 1 if generated files are stale
```

If `init` imported hand-written files, run `cortex compile --force` once so generated files replace them — your content now lives in `.cortex/rules/imported-*.md`.

**Commit `.cortex/` and the generated files.** Cloud agents (Copilot coding agent, Codex, Claude Code on the web) read instruction files straight from the repository.

## Writing rules

```markdown
## Architecture
- Business logic lives in `src/services/`; route handlers stay thin

## Safety
- ! Never commit secrets or `.env` files      ← "!" = critical: emphasised, never dropped first
```

Path-scoped rules use frontmatter and compile to each tool's native scoping (Cursor `globs`, Copilot `applyTo`, Claude `paths`, Kiro `fileMatch`, Windsurf/Antigravity `trigger: glob`):

```markdown
---
scope: ["src/**/*.tsx"]
---
## Components
- Keep components under 150 lines
```

Skills in `.cortex/skills/` compile to the open [Agent Skills](https://agentskills.io/specification) format (`SKILL.md`) in `.claude/skills/`, `.agents/skills/` and `.kiro/skills/` — loaded on demand instead of bloating every prompt.

## Supported tools

| Target id | Tool | Always-on file | Scoped rules | Skills | Limit |
|---|---|---|---|---|---|
| `claude` | Claude Code | `CLAUDE.md` | `.claude/rules/*.md` | `.claude/skills/` | ~200 lines guidance |
| `codex` | AGENTS.md (Codex + 20 tools) | `AGENTS.md` | sections | `.agents/skills/` | 32 KiB |
| `cursor` | Cursor | `.cursor/rules/cortex.mdc` | `.cursor/rules/*.mdc` | `.agents/skills/` | ~500 lines guidance |
| `copilot` | GitHub Copilot | `.github/copilot-instructions.md` | `.github/instructions/*.instructions.md` | `.agents/skills/` | — |
| `gemini` | Gemini CLI | `GEMINI.md` | sections | `.agents/skills/` | — |
| `windsurf` | Windsurf / Devin Desktop | `.windsurf/rules/cortex.md` | `.windsurf/rules/*.md` | `.agents/skills/` | 12,000 chars |
| `kiro` | Kiro | `.kiro/steering/cortex.md` | `.kiro/steering/*.md` | `.kiro/skills/` | — |
| `antigravity` | Antigravity | `.agents/rules/cortex.md` | `.agents/rules/*.md` | `.agents/skills/` | 24,000 bytes |
| `gemini-review` | Gemini Code Assist (PR review) | `.gemini/styleguide.md` | sections | — | — |
| `openai` | ChatGPT (export) | `chatgpt-instructions.md` | sections | — | 5,000 chars |

Verified against vendor documentation on 2026-09-30. The table lives in [`src/engine/targets.js`](src/engine/targets.js) — the CLI, docs and website all render from it.

When AGENTS.md is enabled, tools that read it natively (Cursor, Copilot, Windsurf, Kiro, Antigravity) get their always-on rules from it instead of a duplicate copy (`output.agentsMd: shared`, the default).

## Safety model

- Generated files carry a `Generated by Cortex` marker. Files without it are **never** overwritten without `--force`.
- Generated files edited by hand since the last compile are skipped (content-hash check), not clobbered.
- Files Cortex no longer generates are removed only if untouched.

## Commands

| | |
|---|---|
| **Set up** | `init` · `import` · `assist` · `profile` |
| **Compile & verify** | `compile [--check] [--dry] [-p <id>] [--force] [--json]` · `verify [--strict]` · `diff` · `status` · `watch` |
| **Analyze** | `cost` · `budget [-m <model>]` · `optimize [-p <id>]` · `switch <modelA> <modelB>` · `migrate <toolA> <toolB>` · `update` |
| **Learn & automate** | `learn` · `hooks install` · `sync` |
| **Content** | `add skill <name>` · `add rule <name> --glob "<pattern>"` · `suggest` · `export` |
| **Academy** | `tutorial lanes | phases | scaffold <lane> <dir>` |

Run `cortex help <command>` for examples, or see the [CLI reference](https://cortex1.vercel.app/docs.html#commands).

## Model data that stays current

[`registry/latest.json`](registry/latest.json) tracks pricing and context windows for 200+ models (Anthropic, OpenAI, Google, xAI, DeepSeek, Qwen, Mistral, Meta, Moonshot, Z.ai, MiniMax). The [`refresh-registry`](.github/workflows/refresh-registry.yml) workflow rebuilds it from the OpenRouter catalog every day and commits only real changes; the website redeploys with it. `cortex update` pulls the latest copy; models newer than your copy are priced from the newest model of the same family and tier.

## Academy

A learning library for every technology, AI tool and integration in the Lab, with official docs and hand-picked YouTube channels. It also has build-alongs that show what your project will look like, three runnable lanes (assistant app, workflow agent, MCP server) and six build phases. `cortex tutorial scaffold lane-a ./my-app` gets you started.

## Development

```bash
npm test              # node:test, no dependencies
npm run build         # build the website: site/ → public/
npm run dev           # build + serve on http://localhost:4173
npm run refresh:registry
node bin/cortex.js compile --check   # this repo dogfoods Cortex
```

```
src/engine/     pure, isomorphic compiler (also shipped to the website playground)
src/core/       Node-side: config, registry, manifest, signals, learning
src/commands/   one file per CLI command
site/           website sources (vanilla HTML/CSS/ES modules)
registry/       model data (auto-refreshed) + manual overrides
```

## License

MIT — Copyright (c) 2026 [Phani Marupaka](https://linkedin.com/in/phani-marupaka). Any fork, derivative work, or redistribution must visibly credit the original author and link to [linkedin.com/in/phani-marupaka](https://linkedin.com/in/phani-marupaka). See [LICENSE](LICENSE).
