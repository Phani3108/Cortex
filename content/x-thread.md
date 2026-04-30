# X (Twitter) Thread — Cortex

---

**Tweet 1 (Hook)**

I was maintaining 9 different AI config files.

Same rules. 9 formats. Constant drift.

Claude Code knew my patterns. Cursor didn't. Copilot was 3 weeks behind.

So I built Cortex — a universal context compiler.

Here's how it works 🧵

---

**Tweet 2 (The Pain)**

The problem is real:

→ Claude wants XML tags + direct imperatives
→ GPT wants numbered lists
→ o1/o3 want minimal scaffolding
→ Copilot has a hard 2,000-token limit
→ Each tool reads from a completely different file path

You can't write one file that works for all of them.

So I stopped writing destination files and started writing a source.

---

**Tweet 3 (The Key Insight)**

The same rule needs to be expressed differently for each AI brain.

"Keep components under 150 lines"

→ For Claude: XML-wrapped imperative
→ For GPT: Numbered checklist item
→ For o1: Compressed to one line
→ For Copilot: Budget-optimized (fits 2K tokens)

Cortex compiles one source into 5 different formats automatically.

---

**Tweet 4 (How It Works)**

```bash
cortex init       # Sets up .cortex/ in your project
cortex compile    # Generates 9 native configs
cortex learn      # Reads git history, evolves rules
cortex watch      # Auto-recompiles as you work
```

After `cortex compile`, your project has:

✅ CLAUDE.md
✅ .cursor/rules/project.mdc
✅ .github/copilot-instructions.md
✅ GEMINI.md
✅ codex.md
✅ + 4 more

All in sync. All formatted correctly.

---

**Tweet 5 (The Learning Loop)**

The part I'm most proud of: `cortex learn`

It reads your git diffs after each commit.

Notices you always renamed handleX → onX.
Notices you always extracted the API call the AI inlined.
Notices you always added the error boundary it forgot.

Turns those patterns into rules. Confidence-scored. Yours.

Every commit teaches Cortex what to keep.

---

**Tweet 6 (Real Numbers)**

Before Cortex:
→ Setup one new provider: 15 min
→ Update rules across all tools: 8 min × 9 = 72 min
→ Team onboarding: 30 min per developer

After Cortex:
→ Setup one new provider: 0.1 sec
→ Update rules everywhere: one compile
→ Team onboarding: git pull + cortex compile = 2 min

---

**Tweet 7 (The Philosophy)**

Everyone is chasing the next model release.

GPT-5. Claude 4. Gemini Ultra.

The real alpha isn't the model.

It's the system that outlasts any single model.

Your `.cortex/rules/` after a month of signals is something no one else has. Portable. Diffable. Under version control.

The model is table stakes. Your context is the moat.

---

**Tweet 8 (The Stack)**

Built with:
→ Pure Node.js (zero external dependencies)
→ 11,134 lines of code
→ Regex-based model family classification (works for gpt-5.1 before it exists)
→ 3-layer registry resolution (offline-capable)
→ Impact-scored compression (right rules survive budget limits)

Open source. MIT licensed.

---

**Tweet 9 (CTA)**

If you're using more than one AI coding tool, you need Cortex.

```bash
npm install -g cortex-aictx
cortex init
cortex compile
```

→ Site: cortex1.vercel.app
→ GitHub: github.com/Phani3108/Cortex

RT if you've felt the pain of nine AI configs drifting apart 🙏

---

## Standalone Launch Tweet (Alternative to Thread)

I spent 3 weeks training Claude Code to know my patterns.

Switched to Cursor. It had no idea any of that existed.

So I built Cortex.

One `.cortex/` source → 9 native AI configs (Claude, Cursor, Copilot, Gemini, Codex, Windsurf, Kiro...)

All synced. All formatted for each model's brain. Auto-learning from your git history.

cortex1.vercel.app
