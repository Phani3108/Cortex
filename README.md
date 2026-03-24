# 🧠 Cortex

**One config. Every AI coding tool. Zero drift.**

🌐 **[cortex1.vercel.app](https://cortex1.vercel.app/)** · 📦 [GitHub](https://github.com/Phani3108/Cortex)

Cortex is a universal context engine that compiles a single `.cortex/` source into native config files for 9 AI coding tools — so every tool gets the same rules, skills, and style, always in sync.

---

## ⚡ The Problem

You use Claude Code, Cursor, Copilot, Gemini, and others — but each has its own config format. You end up:

- ✍️ Writing the same rules in 4 different files
- 🔀 Configs drifting out of sync across tools
- 🧑‍🤝‍🧑 Team members getting inconsistent AI behavior
- 🕐 Spending 15+ min per tool on manual setup

**Cortex fixes this in one command.**

---

## 🚀 Features

### 🔧 Engineering

- **🔁 One Source → 9 Outputs** — Write rules once in `.cortex/`, compile to Claude, Cursor, Copilot, Windsurf, Gemini, Codex, Kiro, Antigravity, and OpenAI
- **🧬 Model-Aware Formatting** — Automatically adapts output format per model family (XML tags for Claude, numbered lists for Copilot, minimal scaffolding for reasoning models)
- **📡 Signal Detection** — Scans git diffs, linter output, and AI chat logs to detect patterns in your workflow
- **🔄 Learning Loop** — `cortex learn` captures signals → evolves rules → recompile propagates to all tools
- **🪝 Git Hooks** — Auto-learn on commit, auto-recompile when `.cortex/` changes
- **📦 Import Existing Config** — Already have a `CLAUDE.md` or `.cursorrules`? Import them into `.cortex/` in one command
- **👀 Watch Mode** — Auto-recompile and auto-learn as you edit, in real time

### 📊 Product

- **🤖 Guided Assistant** — `cortex assist` walks you through setup with questions, not docs
- **📈 Impact Metrics** — Tracks time saved, consistency score, and learning velocity across your project
- **🧠 Session Memory** — Remembers your goals, decisions, and progress between runs
- **💰 Token Cost Analysis** — See exactly how much context you're sending to each provider
- **📤 Diff & Export** — See what changed since last compile; export your entire context for sharing

### 🏢 GTM / Team Value

- **⏱️ Setup in 60 seconds** — `cortex init` + `cortex compile` and you're done
- **👥 Team Consistency** — Commit `.cortex/` to git; every teammate runs `cortex compile` and gets identical AI behavior
- **🔌 9 Providers, 1 Workflow** — Switch tools freely without rewriting config
- **📚 Shareable Skills** — Package reusable expertise (TDD, security audits, debugging) as portable skill files
- **🔄 Sync from Upstream** — Pull community rules and skills from remote registries

---

## 🛠️ Installation

```bash
# Clone the repo
git clone https://github.com/Phani3108/Cortex.git
cd Cortex

# Install globally (makes `cortex` available everywhere)
npm install -g .

# Or run directly without installing
node bin/cortex.js
```

---

## 🏁 Quick Start

```bash
# 1. Initialize Cortex in your project
cortex init

# 2. Enable the tools you use (edit .cortex/config.yaml)
#    providers: claude, cursor, copilot, gemini, windsurf, codex, kiro, antigravity, openai

# 3. Compile — generates native config for every enabled tool
cortex compile

# 4. Done. Your AI tools now share the same intelligence.
```

---

## 📋 Commands

| Command | What it does |
|---------|-------------|
| `cortex init` | Initialize `.cortex/` in your project |
| `cortex compile` | Generate provider-specific config files |
| `cortex learn` | Capture signals and evolve your rules |
| `cortex watch` | Auto-recompile and auto-learn as you work |
| `cortex assist` | Guided conversational setup |
| `cortex import` | Import existing CLAUDE.md, .cursorrules, etc. |
| `cortex diff` | See what changed since last compile |
| `cortex cost` | Token cost analysis across providers |
| `cortex hooks install` | Install git hooks for auto-learning |
| `cortex add skill <name>` | Add a skill template (tdd, security-audit, debugging) |
| `cortex sync` | Pull rules/skills from remote sources |
| `cortex status` | Show current configuration |
| `cortex export` | Export context for sharing or backup |
| `cortex profile` | Manage your personal AI style globally |

---

## 🎯 Supported Providers

| Provider | Output Files |
|----------|-------------|
| 🟠 **Claude Code** | `CLAUDE.md` + `.claude/commands/*.md` |
| 🟣 **Cursor** | `.cursor/rules/project.mdc` |
| 🔵 **GitHub Copilot** | `.github/copilot-instructions.md` |
| 🟢 **Windsurf** | `.windsurf/rules/project.md` |
| 🔴 **Gemini CLI** | `GEMINI.md` + `.gemini/style-guide.md` |
| ⚫ **OpenAI Codex** | `codex.md` |
| 🟡 **Amazon Kiro** | `.kiro/rules/*.md` |
| 🔵 **Antigravity** | `.agent/skills/*.md` |
| ⬜ **OpenAI ChatGPT** | `chatgpt-instructions.md` |

---

## 📁 Project Structure

```
.cortex/                  ← Your source of truth (commit this)
  config.yaml             ← Providers, language, preferences
  rules/                  ← Project rules (style, architecture, testing)
  skills/                 ← Reusable skills (TDD, security, debugging)

bin/cortex.js             ← CLI entry point
src/
  commands/               ← CLI command handlers
  core/                   ← Compiler, signals, metrics, assistant
  providers/              ← Provider-specific output generators
  utils/                  ← File system, logging, YAML helpers
templates/                ← Built-in rule & skill templates
```

---

## 🧩 How It Works

```
 .cortex/rules/    ─┐
 .cortex/skills/    ├──▶  cortex compile  ──▶  CLAUDE.md
 .cortex/config.yaml┘         │               .cursorrules
                               │               copilot-instructions.md
                               │               GEMINI.md
                               │               ... (9 formats)
                               ▼
                        Model-aware formatting
                        (XML, numbered lists,
                         minimal, etc.)
```

---

## 📄 License

MIT License — Copyright (c) 2026 [Phani Marupaka](https://linkedin.com/in/phani-marupaka)

---

🌐 **Live:** [cortex1.vercel.app](https://cortex1.vercel.app/) · 📦 **Source:** [github.com/Phani3108/Cortex](https://github.com/Phani3108/Cortex)

Created & Developed by **Phani Marupaka**. All rights reserved under applicable copyright law.

Any fork, derivative work, or redistribution must visibly credit the original author and include a link to [linkedin.com/in/phani-marupaka](https://linkedin.com/in/phani-marupaka).

See [LICENSE](LICENSE) for full terms.

---

**Built for engineers who use more than one AI tool and want them all to be equally smart.**
