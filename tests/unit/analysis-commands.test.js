// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * End-to-end tests for the analysis commands:
 * verify, status, diff, cost, budget, switch, migrate, optimize.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'cortex.js');
const REGISTRY = JSON.parse(readFileSync(join(dirname(CLI), '..', 'registry', 'latest.json'), 'utf-8'));

const RULES = `# Rules
## Security
- ! Never commit secrets or \`.env\` files.
## Style
- Use 2-space indentation.
- Prefer named exports.
`;

function project({ providers = { claude: true, codex: true }, rules = RULES, extraConfig = '', cortex = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cortex-analysis-'));
  const home = mkdtempSync(join(tmpdir(), 'cortex-analysis-home-'));
  mkdirSync(join(root, '.git'));
  if (cortex) {
    mkdirSync(join(root, '.cortex', 'rules'), { recursive: true });
    const lines = ['project:', '  name: demo', 'providers:', ...Object.entries(providers).map(([k, v]) => `  ${k}: ${v}`)];
    writeFileSync(join(root, '.cortex', 'config.yaml'), lines.join('\n') + '\n' + extraConfig);
    writeFileSync(join(root, '.cortex', 'rules', 'project.md'), rules);
  }
  const run = (...args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, HOME: home, CORTEX_HOME: join(home, '.cortex'), NO_COLOR: '1' },
    });
    return { code: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
  };
  const cleanup = () => { rmSync(root, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); };
  return { root, run, cleanup };
}

function bigRules(n = 60) {
  const lines = ['## Security', '- ! Never log secrets or tokens.', '## Docs'];
  for (let i = 1; i <= n; i++) lines.push(`- Documentation rule ${i}: keep README section ${i} updated with examples and explanations of behaviour.`);
  return lines.join('\n') + '\n';
}

describe('no .cortex/', () => {
  for (const cmd of ['verify', 'status', 'diff', 'cost', 'budget', 'optimize']) {
    test(`${cmd} exits 1 with a clear message`, () => {
      const p = project({ cortex: false });
      try {
        const r = p.run(cmd);
        assert.equal(r.code, 1);
        assert.match(r.out, /\.cortex\/ not found.*cortex init/);
      } finally { p.cleanup(); }
    });
  }
});

describe('verify', () => {
  test('fails before compile, passes after', () => {
    const p = project();
    try {
      const before = p.run('verify');
      assert.equal(before.code, 1);
      assert.match(before.out, /CLAUDE\.md has not been generated/);
      assert.equal(p.run('compile', '-q').code, 0);
      const after = p.run('verify');
      assert.equal(after.code, 0, after.out);
      assert.match(after.out, /All checks passed/);
      assert.doesNotMatch(after.out, /settings\.local\.json/);
    } finally { p.cleanup(); }
  });

  test('detects hand edits; --json is machine-readable', () => {
    const p = project();
    try {
      p.run('compile', '-q');
      appendFileSync(join(p.root, 'CLAUDE.md'), '- Added by hand\n');
      const r = p.run('verify', '--json');
      assert.equal(r.code, 1);
      const json = JSON.parse(r.stdout);
      assert.equal(json.ok, false);
      assert.ok(json.errors.some(e => e.code === 'hand-edited' && e.file === 'CLAUDE.md'));
      assert.equal(json.targets.codex.status, 'up_to_date');
    } finally { p.cleanup(); }
  });

  test('detects stale outputs after sources change', () => {
    const p = project();
    try {
      p.run('compile', '-q');
      appendFileSync(join(p.root, '.cortex', 'rules', 'project.md'), '- Use pnpm.\n');
      const r = p.run('verify');
      assert.equal(r.code, 1);
      assert.match(r.out, /out of date with \.cortex/);
    } finally { p.cleanup(); }
  });

  test('unknown providers warn; --strict fails on warnings', () => {
    const p = project({ providers: { claude: true, aider: true } });
    try {
      p.run('compile', '-q');
      const r = p.run('verify');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Unknown provider "aider"/);
      assert.equal(p.run('verify', '--strict').code, 1);
    } finally { p.cleanup(); }
  });

  test('reports rules dropped to fit a hard budget', () => {
    const p = project({ providers: { openai: true }, rules: bigRules() });
    try {
      p.run('compile', '-q');
      const json = JSON.parse(p.run('verify', '--json').stdout);
      const dropped = json.warnings.find(w => w.code === 'dropped-rules');
      assert.ok(dropped, JSON.stringify(json.warnings));
      assert.ok(json.targets.openai.dropped.length > 0);
      assert.ok(!json.targets.openai.dropped.some(t => /Never log secrets/.test(t)));
      assert.ok(json.targets.openai.budget.size <= 5000);
    } finally { p.cleanup(); }
  });

  test('-p with a disabled target exits 1', () => {
    const p = project();
    try {
      const r = p.run('verify', '-p', 'gemini');
      assert.equal(r.code, 1);
      assert.match(r.out, /not enabled/);
    } finally { p.cleanup(); }
  });
});

describe('status', () => {
  test('handles unknown provider keys and shows per-target state', () => {
    const p = project({ providers: { claude: true, kiro: true, aider: true } });
    try {
      let r = p.run('status');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Kiro\s+✗ not compiled/);
      p.run('compile', '-q');
      r = p.run('status');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Kiro\s+✓ up to date/);
      assert.match(r.out, /\.kiro\/steering\/cortex\.md/);
      assert.match(r.out, /Unknown provider "aider"/);
      assert.match(r.out, /Registry\s+\d+ models/);
      assert.doesNotMatch(r.out, /new model/);
    } finally { p.cleanup(); }
  });
});

describe('diff', () => {
  test('shows hand edits and pending source changes', () => {
    const p = project();
    try {
      p.run('compile', '-q');
      assert.match(p.run('diff').out, /No changes/);
      appendFileSync(join(p.root, 'CLAUDE.md'), '- Added by hand\n');
      appendFileSync(join(p.root, '.cortex', 'rules', 'project.md'), '- Use pnpm.\n');
      const r = p.run('diff');
      assert.equal(r.code, 0);
      assert.match(r.out, /Edited by hand \(1\)/);
      assert.match(r.out, /\+ - Added by hand/);
      assert.match(r.out, /~ update\s+AGENTS\.md/);
    } finally { p.cleanup(); }
  });
});

describe('cost', () => {
  test('prices always-on files on current registry models', () => {
    const p = project({ providers: { claude: true, codex: true, cursor: true } });
    try {
      const r = p.run('cost');
      assert.equal(r.code, 0, r.out);
      assert.doesNotMatch(r.out, /< \$0\.01/);
      assert.match(r.out, new RegExp(REGISTRY.highlights.anthropic.sonnet.replace('.', '\\.')));
      assert.match(r.out, /AGENTS\.md — AGENTS\.md, Cursor/);
      const json = JSON.parse(p.run('cost', '--json').stdout);
      assert.equal(json.sessionsPerDay, 20);
      assert.equal(json.workingDays, 22);
      const row = json.files[0].models[0];
      assert.ok(row.tokens > 0 && row.per1kSessions > 0 && row.perMonth > 0);
    } finally { p.cleanup(); }
  });

  test('flags unknown models as estimated', () => {
    const p = project();
    try {
      const r = p.run('cost', '-m', 'claude-sonnet-99');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /~est\./);
    } finally { p.cleanup(); }
  });
});

describe('budget', () => {
  test('honours context.include and skips .cortex/ and generated files', () => {
    const p = project({ extraConfig: 'context:\n  include:\n    - src/\n' });
    try {
      mkdirSync(join(p.root, 'src'));
      mkdirSync(join(p.root, 'other'));
      writeFileSync(join(p.root, 'src', 'a.ts'), 'export const a = 1;\n');
      writeFileSync(join(p.root, 'other', 'b.ts'), 'export const b = 2;\n');
      writeFileSync(join(p.root, 'package-lock.json'), '{}');
      p.run('compile', '-q');
      const json = JSON.parse(p.run('budget', '--json').stdout);
      assert.equal(json.project.textFiles, 1);
      assert.equal(json.alwaysOn.files[0].path, 'CLAUDE.md');
      assert.equal(json.comparison.filter(c => c.current).length, 1);
    } finally { p.cleanup(); }
  });

  test('-m with an unknown model is labelled estimated and highlighted once', () => {
    const p = project();
    try {
      const r = p.run('budget', '-m', 'claude-sonnet-99');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /not in the registry/);
      assert.match(r.out, /~est\./);
      assert.equal((r.out.match(/→ /g) || []).length, 1);
    } finally { p.cleanup(); }
  });
});

describe('switch', () => {
  test('context comparison comes from registry numbers', () => {
    const p = project();
    try {
      const from = REGISTRY.highlights.anthropic.haiku;
      const to = REGISTRY.highlights.openai.sol;
      const json = JSON.parse(p.run('switch', from, to, '--json').stdout);
      const [a, b] = [REGISTRY.models[from].contextWindow, REGISTRY.models[to].contextWindow];
      assert.equal(json.contextWindow.from, a);
      assert.equal(json.contextWindow.to, b);
      const ctx = json.capabilities.find(c => c.label === 'context window');
      if (a !== b) assert.equal(ctx.direction, b > a ? 'gained' : 'lost');
      // Same char count, per-model chars-per-token
      assert.ok(json.from.tokens > 0 && json.to.tokens > 0);
      assert.equal(json.from.estimated, false);
    } finally { p.cleanup(); }
  });

  test('unknown models do not crash and are flagged', () => {
    const p = project();
    try {
      const r = p.run('switch', 'claude-sonnet-99', 'totally-unknown-model');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /~est\./);
    } finally { p.cleanup(); }
  });
});

describe('migrate', () => {
  test('uses TARGETS and real commands', () => {
    const p = project();
    try {
      const r = p.run('migrate', 'copilot', 'windsurf');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /\.windsurf\/rules\/cortex\.md/);
      assert.match(r.out, /12,000 chars \(hard limit\)/);
      assert.match(r.out, /cortex compile -p windsurf/);
      assert.match(r.out, /providers\.windsurf: true/);
      assert.equal(p.run('migrate', 'aider', 'cursor').code, 1);
    } finally { p.cleanup(); }
  });
});

describe('optimize', () => {
  test('lists exactly which rules a hard budget drops; never empties the file', () => {
    const p = project({ providers: { openai: true, claude: true }, rules: bigRules() });
    try {
      const r = p.run('optimize');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /left out/);
      const json = JSON.parse(p.run('optimize', '--json').stdout);
      const openai = json.targets.find(t => t.id === 'openai');
      assert.ok(openai.kept > 0);
      assert.ok(openai.dropped.length > 0);
      assert.ok(openai.size <= openai.hard);
      assert.ok(!openai.dropped.some(d => d.priority === 'critical'));
      assert.equal(json.targets.find(t => t.id === 'claude').dropped.length, 0);
    } finally { p.cleanup(); }
  });

  test('-p analyses a target that is not enabled', () => {
    const p = project();
    try {
      const r = p.run('optimize', '-p', 'windsurf');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /\.windsurf\/rules\/cortex\.md: \d[\d,]* \/ 12,000 chars/);
      assert.match(r.out, /not enabled/);
    } finally { p.cleanup(); }
  });
});
