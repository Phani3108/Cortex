# I Was Rewriting My AI Rules 9 Times a Week. So I Built Cortex.

**One source of truth. Nine AI tools. Zero drift.**

---

My CLAUDE.md had 47 rules.

My `.cursorrules` had 23.

My Copilot instructions had 11.

None of them matched.

I'd spend a Sunday evening carefully tuning my Claude Code context — the right tone, the right patterns, the things I never wanted it to do again. By Tuesday, my Cursor session had no idea any of that existed. By Thursday, Copilot was still generating code the way it was before I started any of this.

I wasn't using nine AI tools. I was maintaining nine separate personalities for tools that were all supposed to know me.

So I stopped rewriting and started compiling.

Not a concept. Not a weekend prototype. 11,000 lines of production code running in real projects. I call it **Cortex**.

---

## The Pain Was Embarrassingly Real

Here's what my week actually looked like before Cortex:

- Monday: Update CLAUDE.md after a painful session where it kept using `var` instead of `const`
- Tuesday: Realize Cursor still doesn't know about this. Update `.cursor/rules/project.mdc`
- Wednesday: Copilot generates a massive function in a file I explicitly said to keep modular. Dig up `.github/copilot-instructions.md` to add the rule
- Thursday: Onboard a new teammate. 30 minutes per tool × 4 tools = two hours of copying and pasting context across formats I barely remember
- Friday: Run `git diff` and discover that what I thought was a shared team standard had silently diverged across every tool

Five tools. Four different file formats. Three different token budgets. Two hours of weekly maintenance. One developer slowly going insane.

The breaking point was a single Cursor session.

I'd spent three weeks with Claude Code learning how I like to structure React components. It had started generating exactly the right patterns — the naming conventions, the separation of concerns, the way I like to handle errors. It felt like it genuinely knew me.

Then I switched to Cursor for a frontend sprint. Thirty minutes in, it was generating components in a completely different style. All that accumulated context — gone. Because Cursor reads from a completely different file that I had never updated.

I sat there staring at the generated code thinking: *this is the same project. This is the same team. Why does my AI have amnesia every time I switch tabs?*

---

## Why One Big File Didn't Fix It

My first instinct was to write one master context file and copy it everywhere. A single source of truth. Problem solved, right?

Wrong.

Here's the thing nobody tells you: different AI models are not the same brain in different clothes. They have fundamentally different formatting preferences, different context window behaviors, and different ways of reading instructions.

**Claude** wants XML-tagged sections and direct imperatives. "Always use `const`" lands better than "Please prefer const declarations."

**GPT-4** works best with numbered lists and system-prompt-style structure. The same rule, written for Claude, reads awkwardly in a GPT context.

**OpenAI's reasoning models** (o1, o3) want minimal scaffolding. You overload them with instructions and they start ignoring the low-priority ones entirely.

**Gemini** prefers context-first. Give it the situation before the instruction.

And then there's the budget problem.

Copilot has a **2,000-token hard limit** on context. Claude Code is effectively unlimited. If you copy your 5,000-token Claude context into Copilot's instruction file, Copilot silently truncates it from the bottom — which means your most specific, hard-earned rules get dropped first.

One file doesn't work because one file assumes one brain. The AI coding world has five different brains, and they need different formatting to do the same job.

---

## Meet The Architecture

Cortex has five core systems. I gave them names because they earned them.

### The Families

The first problem I had to solve was: how do you write code that works for `claude-sonnet-4.6` today and `claude-opus-5.0` six months from now without rewriting anything?

The answer is model families.

Every model gets classified into a family — `anthropic`, `openai-gpt`, `openai-reasoning`, `gemini`, `open-source` — using regex pattern matching, not hardcoded lists. The patterns are stable. `gpt-5.1`, `claude-sonnet-4.6`, `gemini-3.3-flash` all resolve correctly the day they're released without a single code change. Unknown models fall back to tier defaults based on naming patterns.

Each family carries stable metadata: how it reads formatting, how it handles instruction density, what its typical context window looks like, what its token costs are. The whole system is future-proof because it classifies behavior, not names.

### The Compiler

The Compiler is 273 lines and does one thing: takes your rules and formats them correctly for each model's brain.

The same rule — "always separate business logic from UI components" — becomes:

- For Claude: `<rule>Separate business logic from UI components. Never colocate API calls with render logic.</rule>`
- For GPT: `4. Business/UI Separation: Keep business logic in separate hooks or services. UI components handle rendering only.`
- For o1/o3: `Business logic lives in hooks/services. UI renders only.`
- For Gemini: `Context: This is a React project with a clear separation pattern. Rule: Business logic must never appear directly in component files.`
- For Copilot: A compressed single line that fits within the 2K budget.

Same intent. Five translations. All generated automatically from one source.

### The Signals

The Signals system is where Cortex learns.

Every time you make a git commit, Signals reads the diff. It looks at what the AI generated versus what you actually kept. It tracks which files you touched after AI-generated output. It reads your existing provider configs to extract accumulated wisdom. It detects your project's stack from config files and infers implicit rules.

Each signal gets a confidence score from 0.0 to 1.0:
- User corrections to AI output: 0.9
- Auto-detected patterns from git history: 0.8
- Code style signals: 0.6

High-confidence signals evolve into rules. Low-confidence signals wait for more evidence.

### The Registry

Not every project uses the same models. Not every team uses the same budget tier. The Registry solves this with three-layer resolution:

1. **Bundled data** — ships with the package, always available offline
2. **Local cache** — synced from remote, updated periodically
3. **Family tier defaults** — always works even for completely unknown models

Your local overrides always win. The registry never overwrites your explicit configuration.

### The Budget

The Budget system is the enforcer.

Before Cortex compiles, it estimates token usage per provider. Copilot gets 2,000 tokens — it will not exceed this. Cursor gets 8,000. The rules are then sorted by impact score (frequency × specificity × coverage ÷ token cost) and compressed if necessary.

If compression is needed, it's impact-aware. Your most important rules survive. The boilerplate gets trimmed.

---

## How It Actually Works

Here's what a real session looks like:

```
your-project/
├── .cortex/
│   ├── config.yaml       # Which providers to compile for
│   ├── profile.yaml      # Your personal AI style preferences
│   └── rules/
│       ├── default.md    # Core project rules
│       ├── security.md   # Security guidelines
│       └── testing.md    # Test patterns
```

You write rules once, in plain markdown:

```markdown
# Code Style

Always use `const` for variables that aren't reassigned.
Separate business logic from UI components.
Never colocate API calls with render logic.
Keep functions under 40 lines. Extract helpers aggressively.
```

Then:

```bash
cortex init         # Creates .cortex/ in your project (< 60 seconds)
cortex compile      # Generates native config files for all enabled providers
cortex learn        # Reads git history, evolves rules from your patterns
cortex watch        # Stays in sync as you work, recompiles on changes
```

After `cortex compile`, your project has:

```
CLAUDE.md                              ← Claude Code
.cursor/rules/project.mdc             ← Cursor
.github/copilot-instructions.md       ← GitHub Copilot
.windsurf/rules/project.md            ← Windsurf
GEMINI.md                             ← Gemini CLI
codex.md                              ← OpenAI Codex
.kiro/rules/project.md                ← Amazon Kiro
chatgpt-instructions.md               ← ChatGPT
.agent/skills/project.md              ← Antigravity
```

All of them. At once. In sync. Formatted correctly for each.

---

## The Key Insight: One Rule, Five Languages

This is the thing that made everything click.

A context rule is not a sentence. It's an intent. And that intent needs to be expressed differently depending on who's reading it.

Here's a real example. This rule in `.cortex/rules/default.md`:

```markdown
Keep React components under 150 lines. Extract child components
and custom hooks when components grow. Use named exports only.
```

Gets compiled to:

**In CLAUDE.md:**
```
<code-structure>
Keep React components under 150 lines. Extract child components
and custom hooks when components exceed this limit. Use named
exports exclusively — no default exports.
</code-structure>
```

**In `.cursor/rules/project.mdc`:**
```
3. Component Size: React components stay under 150 lines.
   - Extract child components when approaching limit
   - Custom hooks for stateful logic
   - Named exports only (no default exports)
```

**In `.github/copilot-instructions.md`** (budget-compressed):
```
React: max 150 lines/component, extract hooks, named exports only.
```

One source. Three outputs. The right language for each brain.

The coordination is the source file. Not the destination files.

---

## The Learning Loop

`cortex learn` is the command that compounds.

Run it after a week of coding and Cortex reads your git history. It looks at what changed between AI-generated drafts and your committed code. It finds patterns:

- You always renamed `handleX` to `onX` — becomes a naming convention rule
- You always extracted the API call that the AI inlined — becomes a separation rule
- You always added error boundaries that the AI forgot — becomes a required pattern

Each pattern gets a confidence score. High-confidence patterns surface as rule suggestions. You review, approve, and the next `cortex compile` bakes them into all nine tools simultaneously.

The loop:

```
Code with AI → Review output → Commit changes → cortex learn
→ Rules evolve → cortex compile → All tools updated → Repeat
```

Every commit teaches Cortex what to keep. Every edit signals what the AI got wrong.

After four weeks, your `.cortex/rules/` directory is a fingerprint of how you actually code. Not how you think you code. How you actually code.

---

## What Breaks (And How I Fixed It)

Honest failures, because they're more useful than the success story:

**Model classification edge cases.** Early versions had hardcoded model lists. The first time a new Claude version released, everything broke. Fixed it with regex-based family matching and tier defaults. Unknown models now degrade gracefully rather than crashing.

**Token budget enforcement destroying rule structure.** My first compression algorithm was naive — it just cut from the bottom. It would truncate mid-sentence. Fixed with impact-scored compression: rules are sorted by value, and only complete rules get dropped when budgets are tight.

**Registry staleness.** Pricing data and model specs change constantly. A cached registry that's 60 days stale gave wrong token estimates. Fixed with three-layer resolution: bundled baseline → local synced cache → family defaults. The system is always correct, even offline.

**Community rules of unknown quality.** I built a community rules system so people could share and suggest rules for popular stacks. The temptation was to auto-apply them. I resisted. Cortex will never auto-apply any rule it didn't learn from your own git history. Community rules are always presented for approval. Your context is yours.

**Coordination conflicts in team settings.** Two engineers updating `.cortex/` simultaneously could create drift. Fixed by making `.cortex/` the only thing in git. Everything else is a build artifact. You don't commit `CLAUDE.md` any more than you commit `dist/`. The source is the source.

---

## Real Numbers

I track these. You should too.

| Task | Before Cortex | After Cortex |
|------|--------------|--------------|
| Setup one new provider | 15 min | 0.1 sec |
| Update rules across all tools | 8 min × 9 providers | 0.1 sec (one compile) |
| Team onboarding | 30 min per developer | 2 min (git pull + compile) |
| Learn from a week of feedback | 20 min manual | 0.5 sec (cortex learn) |

Nine providers supported. 11,134 lines of pure Node.js. Zero external dependencies. Everything runs locally.

Token savings vary by project, but on a typical 5,000-token ruleset: Copilot receives a precision-compressed 1,800-token version that keeps every high-impact rule and drops the boilerplate. Cursor gets 4,200 tokens of structured MDC. Claude gets the full context with proper XML structure.

---

## How To Start

Do not try to do everything at once. This is the mistake.

**Week 1: One tool, one compile**

```bash
npm install -g cortex-aictx
cd your-project
cortex init
# Edit .cortex/config.yaml — enable only claude-code for now
cortex compile
```

Open the generated `CLAUDE.md`. You'll recognize your patterns in it. That's it for week one. Just use Claude Code normally and watch the output.

**Week 2: Add learning**

Run `cortex learn` after each PR merge. Review the suggested rules. Approve the ones that resonate. Watch your context sharpen.

**Week 3: Enable more tools**

Add Cursor or Copilot in `config.yaml`. Run `cortex compile`. All your accumulated rules, instantly translated for the new tool. This is the moment Cortex pays off.

**Week 4+: Let it compound**

Set up `cortex watch` to recompile on changes. Add it to your CI pipeline so teammates always get fresh context after merges. Let Signals run for a month and watch what it learns.

Treat it like a new developer joining the team. They don't know everything on day one. But they get better every week, and after a month, they're genuinely useful.

---

## The Mental Shift

Something changes when you stop thinking about AI tools as separate products and start thinking about them as separate rendering targets.

The AI coding tool landscape is fragmenting fast. Claude Code, Cursor, Copilot, Gemini CLI, Windsurf, Kiro — each is building its own experience, its own file format, its own way of reading context. Every few months a new one lands. The race for model quality is flattening; everyone has access to Claude, GPT, and Gemini. The differentiation is in the IDE integration, the UX, the workflow.

Which means the question is no longer "which AI tool is best?" It's "how do I maintain my context across all of them?"

Everyone is chasing the next model release. The real alpha is in the system that outlasts any single model.

Your `.cortex/rules/` directory, after four weeks of signals and learning, is something no one else has. It's your coding patterns, your team's standards, your project's accumulated wisdom — structured, scored by impact, and compiled into every tool simultaneously. No model upgrade changes it. No new provider wipes it. It's portable, diffable, and under version control.

The model is table stakes. Your context is the moat.

Every `cortex compile` makes your tools smarter. Every `cortex learn` makes your rules tighter. Every commit adds a data point to the signal loop.

The compounding starts the day you run `cortex init`.

---

## Start Today

```bash
npm install -g cortex-aictx
cortex init
cortex compile
```

One source. Nine tools. Zero drift.

**→ [cortex1.vercel.app](https://cortex1.vercel.app)** — try it in your browser first

**→ [github.com/Phani3108/Cortex](https://github.com/Phani3108/Cortex)** — star it, read the code, open issues

If this resonates, share it with someone who's maintaining nine AI config files and wondering why they feel like a part-time config engineer.

---

*Cortex is open source and MIT licensed. Built by Phani Marupaka.*
