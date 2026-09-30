# Changelog

## 2.1.0 — 2026-09-30

The Lab is the product: the homepage is now the planning gate before any AI build.
- Four entry doors for different developers: Just exploring, Point me in a direction, I'm serious (intent-first Architect), I have an existing product.
- Intent questions (problem, users, edge, 90-day metric; feature + must-not-break for existing products).
- Every path ends in a build pack: clarity score with named gaps, architecture lanes, repository skeleton, infra + live AI cost, learning path, phased prompts (locked until the plan is clear), AI rules and PLAN.md download.
- Academy is a learning library: official docs + verified YouTube channels for every technology, AI tool and integration, plus build-alongs.
- Compiler/playground moved to /compiler.html; /stack.html redirects to the Lab.

## 2.0.0 — 2026-09-30

A ground-up correction of the compiler, the data, and the website.

### Output now matches what each tool actually reads (verified 2026-09-30)
- **Kiro:** `.kiro/steering/` with `inclusion:` frontmatter (was the non-existent `.kiro/rules/`).
- **Windsurf / Devin Desktop:** `.windsurf/rules/*.md` with `trigger:` frontmatter, 12,000-char limit enforced (was legacy `.windsurfrules`).
- **Antigravity:** `.agents/rules/*.md`, 24 KB limit enforced (was `.antigravity/instructions.md`, which nothing reads).
- **Cursor:** `.cursor/rules/*.mdc` only (legacy `.cursorrules` no longer written — it duplicated every rule).
- **Gemini Code Assist:** `.gemini/styleguide.md` (was `style-guide.md`).
- **No more invalid settings files:** `.claude/settings.json` and `.gemini/settings.json` were overwritten with keys those tools reject. Cortex no longer writes them, and removes the v1 versions only if untouched.
- **Skills** compile to the Agent Skills standard (`SKILL.md`) in `.claude/skills/`, `.agents/skills/`, `.kiro/skills/` instead of being pasted into every always-on file.
- **Path-scoped rules** (`scope:` frontmatter) compile to native globs for Claude, Cursor, Copilot, Kiro, Windsurf and Antigravity.
- **AGENTS.md sharing:** tools that read AGENTS.md natively no longer get a duplicate copy of your rules.

### Safety
- `compile` never overwrites hand-written files or hand-edited generated files without `--force`; removes stale outputs only when untouched.
- `init` detects the tools you use and imports existing instruction files before anything is compiled.
- `import` no longer re-imports Cortex's own output (which multiplied every rule).
- Fixed shell injection in `cortex sync` (URLs from `config.yaml` reached the shell); https-only, namespaced output.
- `learn` no longer copies one project's rules into your global profile, and no longer deletes previously learned rules.

### New
- `cortex compile --check` for CI drift detection; `--json` reports; `-p` compiles one tool without forgetting the others.
- Hard size limits met by keeping whole, highest-impact rules (critical rules first) and reporting what was left out — no mid-rule truncation, no unclosed XML tags.
- Per-tool `model:` in config switches formatting style (Claude XML, GPT numbered, reasoning compact, Gemini context-first, open-weights explicit).
- Model registry rebuilt daily from OpenRouter by GitHub Actions (212 models); `cortex update --source openrouter`; correct sync URL (it pointed at another user's repository).
- Git hooks that actually run (they failed silently on unknown flags) and block commits with stale generated files.

### Website
- Rebuilt as a multi-page site: live playground running the real engine, tool matrix, live model registry with a context-cost calculator, Stack Lab, Academy and docs generated from the CLI's own tables.
- Correct install command (`npx cortex` ran an unrelated npm package), no placeholder video embeds, accurate CLI reference, light and dark themes, accessible controls.

### Breaking
- npm package renamed to `cortex-aictx` (the `cortex` name belongs to another project). The command is still `cortex`.
- Node 20+.
- Output paths changed as listed above; run `cortex compile` once to migrate — v1 files are cleaned up automatically when unmodified.
