# LinkedIn Post — Cortex

---

## Version A (Builder Story — Recommended)

Six months ago I was spending 2 hours every week doing something embarrassing: copy-pasting the same AI rules into nine different config files.

Different formats. Different token limits. Different file paths. Claude Code reads `CLAUDE.md`. Cursor reads `.cursor/rules/project.mdc`. Copilot reads `.github/copilot-instructions.md`. They all needed the same rules, but each in a completely different language.

And every time I updated one, the others drifted.

The breaking point: I'd spent weeks building up Claude Code's understanding of how I write React components. Then I switched to Cursor for a sprint. It had no memory of any of it. Different file, different format, different brain.

I asked myself: *why am I doing the AI's config work manually when the whole point is to not do manual work?*

So I built **Cortex** — a universal context compiler for AI coding tools.

You write your rules once, in plain markdown, in a `.cortex/` folder. Cortex compiles them into native config files for every AI tool you use — automatically, correctly formatted for each model's preferences, within each provider's token budget.

`cortex compile` → Claude gets XML-structured context. GPT gets numbered lists. Copilot gets a precision-compressed version that fits its 2,000-token limit. All from the same source.

`cortex learn` → reads your git history, learns your patterns, evolves your rules over time.

It took me 11,000 lines of Node.js and three hard-learned lessons:

**1. Different AI models are not the same brain.** Claude, GPT, and Gemini read instructions differently. The same rule lands differently depending on how it's formatted. Building model-family-aware compilation was the hardest and most important part.

**2. The context problem is a build problem.** We already solved this for code: you don't manually write minified JS, you write readable source and compile it. AI configs needed the same pattern.

**3. The real moat isn't the model — it's the accumulated context.** Everyone has access to Claude and GPT. The developer who has four weeks of signal-learned, impact-scored, version-controlled rules has something no one else has.

Cortex is open source and available now.

If your team uses more than one AI coding tool and you've felt the pain of configs drifting apart — this is for you.

→ cortex1.vercel.app
→ github.com/Phani3108/Cortex

Happy to answer questions in the comments about how the architecture works.

---

## Version B (Shorter, Insight-First)

Hot take: the AI coding tool arms race is the wrong race to watch.

Everyone's focused on which model is best this month. GPT-5 vs Claude 4 vs Gemini. The model benchmarks. The context window sizes.

Meanwhile, the real problem is this: most developers using multiple AI coding tools are maintaining completely separate, manually-written configs for each one. Different formats. Different file paths. No sync. Constant drift.

The model gets better every six months. Your context drift gets worse every week.

I built **Cortex** to fix the second problem.

One source of rules (plain markdown). Nine native configs generated automatically. Model-aware formatting. Token budget enforcement. A learning loop that reads your git history and evolves your rules.

Three insights that changed how I think about AI tooling:

→ **Context is infrastructure.** Treat it like code: single source of truth, version controlled, compiled to targets.

→ **Model-aware formatting matters more than most people realize.** Claude and GPT are not interchangeable prompt targets. They need the same information delivered differently.

→ **Accumulated context compounds.** Four weeks of `cortex learn` produces something genuinely unique to your project. It's not the AI that gets smarter — it's the rules around the AI.

Cortex is live and open source.

cortex1.vercel.app | github.com/Phani3108/Cortex

---

## Version C (Team/Enterprise Angle)

If your engineering team uses more than one AI coding tool, you have a hidden consistency problem.

Every developer is running their own versions of the same rules — in different formats, for different tools, at different levels of completeness. The senior engineers have evolved context. New hires start from scratch. Cursor users and Claude Code users are effectively working with different AIs, even on the same codebase.

This is the context drift problem. And it gets worse as your team grows.

I built **Cortex** because I got tired of it.

Cortex is a universal context compiler for AI coding tools. Your team writes shared rules once, in a `.cortex/` folder that lives in your repo. `cortex compile` generates native config files for every tool — Claude Code, Cursor, Copilot, Gemini CLI, Windsurf, Kiro, and more — automatically formatted for each model's preferences and within each provider's token limits.

One `git pull` + `cortex compile` and every developer has the same context, in the right format for the tool they use.

New engineer joins the team? Two minutes to full context instead of thirty.

Rules updated after a sprint retrospective? One compile propagates to all nine tools.

Cortex is open source, MIT licensed, and runs entirely locally (zero external dependencies).

→ cortex1.vercel.app

Would love feedback from teams who've felt this pain.
