// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Command catalog — one list that renders `cortex --help` AND the website's
 * CLI reference, so the docs can never advertise a command that doesn't exist.
 */

export const COMMAND_GROUPS = [
  { id: 'setup', title: 'Set up' },
  { id: 'build', title: 'Compile & verify' },
  { id: 'analyze', title: 'Analyze tokens & models' },
  { id: 'learn', title: 'Learn & automate' },
  { id: 'content', title: 'Rules, skills & packs' },
  { id: 'academy', title: 'Academy' },
];

export const COMMANDS = [
  { name: 'init', group: 'setup', summary: 'Create .cortex/, detect your stack and AI tools, import existing instruction files',
    examples: ['cortex init', 'cortex init --global'] },
  { name: 'import', group: 'setup', summary: 'Bring hand-written CLAUDE.md, AGENTS.md, .cursor/rules, Copilot instructions… into .cortex/',
    examples: ['cortex import', 'cortex import --dry'] },
  { name: 'assist', group: 'setup', summary: 'Guided, question-driven setup (also runs when you type `cortex` alone)',
    examples: ['cortex assist'] },
  { name: 'profile', group: 'setup', summary: 'View or edit your personal style (~/.cortex/profile.yaml)',
    examples: ['cortex profile', 'cortex profile reset --force'] },

  { name: 'compile', group: 'build', summary: 'Generate native files for every enabled tool — never overwrites hand-written files',
    examples: ['cortex compile', 'cortex compile --check', 'cortex compile -p cursor', 'cortex compile --dry', 'cortex compile --json'] },
  { name: 'verify', group: 'build', summary: 'Check generated files are current, within each tool’s limits, and valid',
    examples: ['cortex verify', 'cortex verify --strict'] },
  { name: 'diff', group: 'build', summary: 'Show hand edits to generated files and source changes since the last compile',
    examples: ['cortex diff'] },
  { name: 'status', group: 'build', summary: 'Enabled tools, their files, freshness, and model-data age',
    examples: ['cortex status'] },
  { name: 'watch', group: 'build', summary: 'Recompile automatically when .cortex/ changes',
    examples: ['cortex watch'] },

  { name: 'cost', group: 'analyze', summary: 'What your always-on instructions cost per session across current models',
    examples: ['cortex cost', 'cortex cost -m claude-sonnet-5.5'] },
  { name: 'budget', group: 'analyze', summary: 'Context-window headroom and token breakdown for a model',
    examples: ['cortex budget', 'cortex budget -m gpt-6.1-sol'] },
  { name: 'optimize', group: 'analyze', summary: 'Score rules by impact; see exactly what each size-limited tool would drop',
    examples: ['cortex optimize', 'cortex optimize -p windsurf'] },
  { name: 'switch', group: 'analyze', summary: 'Compare two models: price, context window, formatting style',
    examples: ['cortex switch claude-sonnet-5.5 gpt-6.1-sol'] },
  { name: 'migrate', group: 'analyze', summary: 'Compare two tools: files, scoping, skills, limits — and how to move',
    examples: ['cortex migrate copilot cursor'] },
  { name: 'update', group: 'analyze', summary: 'Refresh model pricing/context data (daily-updated registry) and check for a new version',
    examples: ['cortex update', 'cortex update --source openrouter'] },

  { name: 'learn', group: 'learn', summary: 'Turn project signals and your edits to generated files into rule suggestions',
    examples: ['cortex learn --dry', 'cortex learn'] },
  { name: 'hooks', group: 'learn', summary: 'Git hooks: block commits with stale generated files; learn after each commit',
    examples: ['cortex hooks install', 'cortex hooks status', 'cortex hooks remove'] },
  { name: 'sync', group: 'learn', summary: 'Pull shared rules/skills from https sources listed in config.yaml',
    examples: ['cortex sync'] },

  { name: 'add', group: 'content', summary: 'Add a skill or rule file (bundled templates: tdd, code-review, debugging, security-audit, …)',
    examples: ['cortex add skill tdd', 'cortex add rule react --glob "src/**/*.tsx"'] },
  { name: 'suggest', group: 'content', summary: 'Rule packs that fit your stack (React, TypeScript, Python, security, …)',
    examples: ['cortex suggest', 'cortex suggest packs', 'cortex suggest apply security-basics'] },
  { name: 'export', group: 'content', summary: 'Export your .cortex/ context for sharing or backup',
    examples: ['cortex export'] },

  { name: 'tutorial', group: 'academy', summary: 'Academy lanes and phases; scaffold a runnable sample project',
    examples: ['cortex tutorial lanes', 'cortex tutorial phases', 'cortex tutorial scaffold lane-a ./my-agent'] },
];

export const OPTIONS_HELP = [
  ['-p, --provider <id>', 'Only this target (claude, codex, cursor, copilot, gemini, windsurf, kiro, antigravity, …)'],
  ['-m, --model <id>', 'Model for cost/budget analysis (any id, e.g. claude-sonnet-5.5)'],
  ['--check', 'CI mode for compile: exit 1 if generated files are stale'],
  ['--dry', 'Show what would happen without writing files'],
  ['-f, --force', 'Overwrite hand-written or hand-edited files'],
  ['--json', 'Machine-readable output (compile, verify, status, diff, cost, budget, optimize, switch, migrate)'],
  ['--sessions <n>', 'Sessions per working day for cost estimates (default 20)'],
  ['--strict', 'Treat warnings as failures (verify)'],
  ['-q, --quiet', 'Only print errors'],
  ['-g, --global', 'Use ~/.cortex instead of the project'],
  ['-h, --help', 'Show help'],
  ['-v, --version', 'Show version'],
];
