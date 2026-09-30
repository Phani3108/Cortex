// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compile targets — the single source of truth for how every AI coding tool
 * consumes instructions. The CLI, `cortex verify`, the docs and the website's
 * tool matrix are all generated from this table.
 *
 * Every entry was verified against the vendor's documentation on `verified`.
 * If a tool changes its conventions, change it here and nowhere else.
 */

export const VERIFIED_ON = '2026-09-30';

/** Portable Agent Skills location read by Codex, Cursor, Copilot, Gemini CLI, Antigravity and Devin Desktop. */
export const SHARED_SKILLS_DIR = '.agents/skills';

export const TARGETS = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    vendor: 'Anthropic',
    aliases: ['claude-code'],
    style: 'xml',
    modelHint: 'claude-sonnet',
    mainFile: 'CLAUDE.md',
    scopedPattern: '.claude/rules/cortex-{slug}.md',
    skillsDir: '.claude/skills',
    readsAgentsMd: false, // only when no CLAUDE.md exists — Cortex always writes one
    budget: { unit: 'lines', soft: 200, hard: null, note: 'Anthropic recommends keeping CLAUDE.md around 200 lines; everything in it loads every session.' },
    scoping: 'native — .claude/rules/*.md with `paths:` frontmatter',
    docs: ['https://code.claude.com/docs/en/memory', 'https://code.claude.com/docs/en/skills'],
    notes: 'Skills are emitted as .claude/skills/<name>/SKILL.md (Claude Code does not read .agents/skills).',
  },
  codex: {
    id: 'codex',
    name: 'AGENTS.md',
    vendor: 'OpenAI Codex + 20 tools',
    aliases: ['agents', 'agents-md', 'openai-codex'],
    style: 'markdown',
    modelHint: null,
    mainFile: 'AGENTS.md',
    scopedPattern: null,
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: true,
    budget: { unit: 'bytes', soft: null, hard: 32768, note: 'Codex reads at most 32 KiB of combined AGENTS.md (project_doc_max_bytes).' },
    scoping: 'sections — AGENTS.md has no glob scoping',
    docs: ['https://developers.openai.com/codex/guides/agents-md', 'https://agents.md'],
    notes: 'Read natively by Codex, Cursor, Copilot, Devin Desktop (Windsurf), Kiro, Antigravity, Jules, Zed, Amp, Junie, Roo Code, OpenCode and more.',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    vendor: 'Anysphere',
    aliases: [],
    style: 'markdown',
    modelHint: null,
    mainFile: '.cursor/rules/cortex.mdc',
    scopedPattern: '.cursor/rules/cortex-{slug}.mdc',
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: true,
    budget: { unit: 'lines', soft: 500, hard: null, note: 'Cursor recommends keeping each rule under 500 lines.' },
    scoping: 'native — .mdc `globs` + `alwaysApply`',
    docs: ['https://cursor.com/docs/context/rules', 'https://cursor.com/docs/context/skills'],
    notes: 'Plain .md files in .cursor/rules are ignored by Cursor; rules must be .mdc. `.cursorrules` is legacy.',
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    vendor: 'GitHub',
    aliases: ['github-copilot'],
    style: 'markdown',
    modelHint: null,
    mainFile: '.github/copilot-instructions.md',
    scopedPattern: '.github/instructions/cortex-{slug}.instructions.md',
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: true,
    budget: { unit: 'lines', soft: 200, hard: null, note: 'No hard limit (the 4,000-char code-review cap was removed in June 2026); keep it to ~2 pages.' },
    scoping: 'native — .instructions.md `applyTo`',
    docs: ['https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions', 'https://code.visualstudio.com/docs/copilot/customization/custom-instructions'],
    notes: 'Copilot coding agent, CLI and VS Code also read AGENTS.md and .agents/skills.',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    vendor: 'Google',
    aliases: ['gemini-cli'],
    style: 'gemini',
    modelHint: 'gemini-pro',
    mainFile: 'GEMINI.md',
    scopedPattern: null,
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: false, // only with context.fileName configured
    budget: { unit: 'lines', soft: 300, hard: null, note: 'No documented limit; GEMINI.md loads into every session.' },
    scoping: 'sections — GEMINI.md has no glob scoping',
    docs: ['https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md', 'https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md'],
    notes: 'Gemini CLI does not read AGENTS.md unless `context.fileName` is set, so it always gets its own GEMINI.md.',
  },
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf / Devin Desktop',
    vendor: 'Cognition',
    aliases: ['devin', 'devin-desktop', 'cascade'],
    style: 'markdown',
    modelHint: null,
    mainFile: '.windsurf/rules/cortex.md',
    scopedPattern: '.windsurf/rules/cortex-{slug}.md',
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: true,
    budget: { unit: 'chars', soft: null, hard: 12000, note: 'Workspace rule files are limited to 12,000 characters each.' },
    scoping: 'native — `trigger: glob` + `globs`',
    docs: ['https://docs.devin.ai/desktop/cascade/memories', 'https://docs.devin.ai/desktop/cascade/agents-md'],
    notes: 'Windsurf is now Devin Desktop; it prefers .devin/rules/ and still reads .windsurf/rules/, which Cortex writes for compatibility with both.',
  },
  kiro: {
    id: 'kiro',
    name: 'Kiro',
    vendor: 'Amazon',
    aliases: ['amazon-kiro'],
    style: 'markdown',
    modelHint: 'claude-sonnet',
    mainFile: '.kiro/steering/cortex.md',
    scopedPattern: '.kiro/steering/cortex-{slug}.md',
    skillsDir: '.kiro/skills',
    readsAgentsMd: true,
    budget: { unit: 'lines', soft: 300, hard: null, note: 'No documented limit.' },
    scoping: 'native — `inclusion: fileMatch` + `fileMatchPattern`',
    docs: ['https://kiro.dev/docs/steering/', 'https://kiro.dev/docs/skills/'],
    notes: 'Steering files live in .kiro/steering/ (there is no .kiro/rules/).',
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity',
    vendor: 'Google',
    aliases: [],
    style: 'markdown',
    modelHint: 'gemini-pro',
    mainFile: '.agents/rules/cortex.md',
    scopedPattern: '.agents/rules/cortex-{slug}.md',
    skillsDir: SHARED_SKILLS_DIR,
    readsAgentsMd: true,
    budget: { unit: 'bytes', soft: null, hard: 24000, note: 'Rule files are truncated beyond 24,000 bytes.' },
    scoping: 'native — `trigger: glob` + `globs`',
    docs: ['https://antigravity.google/docs/rules', 'https://antigravity.google/docs/skills'],
    notes: 'Uses .agents/ (plural); .agent/ is legacy. Workflows retire on 2026-11-01 — Cortex emits skills instead.',
  },
  'gemini-review': {
    id: 'gemini-review',
    name: 'Gemini Code Assist (PR review)',
    vendor: 'Google',
    aliases: ['gemini-code-assist', 'styleguide'],
    style: 'markdown',
    modelHint: 'gemini-pro',
    mainFile: '.gemini/styleguide.md',
    scopedPattern: null,
    skillsDir: null,
    readsAgentsMd: false,
    budget: { unit: 'lines', soft: 300, hard: null, note: 'No documented limit.' },
    scoping: 'sections',
    docs: ['https://docs.cloud.google.com/gemini/docs/code-review/customize-repo-review'],
    notes: 'The GitHub PR reviewer reads exactly .gemini/styleguide.md.',
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT (export)',
    vendor: 'OpenAI',
    aliases: ['chatgpt'],
    style: 'numbered',
    modelHint: 'gpt',
    mainFile: 'chatgpt-instructions.md',
    scopedPattern: null,
    skillsDir: null,
    readsAgentsMd: false,
    budget: { unit: 'chars', soft: null, hard: 5000, note: 'Custom instructions accept 5,000 characters on paid plans (1,500 on Free).' },
    scoping: 'sections',
    docs: ['https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions'],
    notes: 'ChatGPT cannot read repository files: paste this file into custom instructions or a Project.',
  },
};

export const TARGET_IDS = Object.keys(TARGETS);

/** Resolve a target id or alias ("agents", "devin", "chatgpt") to its id. */
export function resolveTargetId(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().trim();
  if (TARGETS[key]) return key;
  for (const t of Object.values(TARGETS)) if (t.aliases.includes(key)) return t.id;
  return null;
}

/** Targets enabled by `cortex init` when nothing else is detected. */
export const DEFAULT_TARGETS = ['claude', 'codex', 'cursor', 'copilot'];

/** Files that indicate a tool is already in use (drives `cortex init` detection and `cortex import`). */
export const DETECTION = {
  claude:        ['CLAUDE.md', '.claude/CLAUDE.md', '.claude'],
  codex:         ['AGENTS.md', '.codex'],
  cursor:        ['.cursor/rules', '.cursorrules', '.cursor'],
  copilot:       ['.github/copilot-instructions.md', '.github/instructions'],
  gemini:        ['GEMINI.md', '.gemini/settings.json'],
  windsurf:      ['.windsurf/rules', '.windsurfrules', '.devin/rules'],
  kiro:          ['.kiro/steering', '.kiro'],
  antigravity:   ['.agents/rules', '.agent/rules'],
  'gemini-review': ['.gemini/styleguide.md', '.gemini/config.yaml'],
  openai:        [],
};

/** Existing instruction files `cortex import` knows how to read (native + legacy). */
export const IMPORTABLE = [
  { target: 'claude', path: 'CLAUDE.md' },
  { target: 'claude', path: '.claude/CLAUDE.md' },
  { target: 'claude', dir: '.claude/rules', ext: '.md' },
  { target: 'codex', path: 'AGENTS.md' },
  { target: 'cursor', dir: '.cursor/rules', ext: '.mdc' },
  { target: 'cursor', path: '.cursorrules', legacy: true },
  { target: 'copilot', path: '.github/copilot-instructions.md' },
  { target: 'copilot', dir: '.github/instructions', ext: '.instructions.md' },
  { target: 'gemini', path: 'GEMINI.md' },
  { target: 'gemini-review', path: '.gemini/styleguide.md' },
  { target: 'windsurf', dir: '.windsurf/rules', ext: '.md' },
  { target: 'windsurf', dir: '.devin/rules', ext: '.md' },
  { target: 'windsurf', path: '.windsurfrules', legacy: true },
  { target: 'kiro', dir: '.kiro/steering', ext: '.md' },
  { target: 'antigravity', dir: '.agents/rules', ext: '.md' },
  { target: 'antigravity', dir: '.agent/rules', ext: '.md', legacy: true },
  { target: 'openai', path: 'chatgpt-instructions.md' },
  { target: 'openai', path: '.openai/instructions.md', legacy: true },
];

/** Paths older Cortex versions generated; cleaned up when they still carry the old marker. */
export const LEGACY_OUTPUTS = [
  '.cursorrules', '.windsurfrules', '.antigravity/instructions.md', '.openai/instructions.md',
  '.gemini/style-guide.md', '.gemini/settings.json', '.claude/settings.json', '.kiro/rules/project.md',
  '.cursor/rules/project.mdc',
];
