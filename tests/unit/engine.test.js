// Engine: parsing, formatting, budgets, targets — pure functions, no fs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, parseRuleFile, parseSkillFile, formatRules, fitRules, TARGETS, TARGET_IDS, resolveTargetId, isGenerated, measure } from '../../src/engine/index.js';
import { COMMANDS } from '../../src/engine/commands.js';
import { readdirSync } from 'node:fs';

const all = Object.fromEntries(TARGET_IDS.map(id => [id, true]));

test('parseRuleFile: categories, nested bullets, criticals, paragraphs, frontmatter scope', () => {
  const { rules, meta } = parseRuleFile(`---\nscope: ["src/**/*.tsx"]\n---\n# Title\n## Code Style\n- Use const\n  - never var\n* Star bullet\n1. Numbered rule\n- ! Never commit secrets\n\nA paragraph rule.\n`, 'r.md');
  assert.deepEqual(meta.scope, ['src/**/*.tsx']);
  assert.equal(rules.length, 5);
  assert.equal(rules[0].text, 'Use const — never var');
  assert.equal(rules[0].category, 'code style');
  assert.equal(rules[0].label, 'Code Style');
  assert.equal(rules[3].priority, 'critical');
  assert.equal(rules[3].text, 'Never commit secrets');
  assert.deepEqual(rules[0].scope, ['src/**/*.tsx']);
});

test('parseSkillFile derives a valid name and description', () => {
  const s = parseSkillFile('# Test Driven\n\nWrite the failing test first.\n', 'My Skill.md');
  assert.equal(s.name, 'my-skill');
  assert.equal(s.description, 'Write the failing test first.');
});

test('formatRules: XML tags are always valid identifiers', () => {
  const out = formatRules([{ text: 'x', category: 'ai interaction', label: 'AI Interaction' }], 'xml');
  assert.match(out, /<ai_interaction>\n- x\n<\/ai_interaction>/);
  assert.doesNotMatch(out, /<[a-z]+ [a-z]+>/);
});

test('every target produces its documented main file and SKILL.md skills', () => {
  const r = compile({
    ruleFiles: [{ path: 'p.md', content: '## A\n- rule one\n' }],
    skillFiles: [{ path: 'review.md', content: '---\nname: review\ndescription: Review code\n---\nSteps' }],
    config: { providers: all, output: { agentsMd: 'duplicate' } },
  });
  for (const id of TARGET_IDS) {
    const t = TARGETS[id];
    assert.ok(r.outputs.some(o => o.path === t.mainFile), `${id} main file ${t.mainFile}`);
    if (t.skillsDir) assert.ok(r.outputs.some(o => o.path === `${t.skillsDir}/review/SKILL.md`), `${id} skill`);
  }
  for (const o of r.outputs) assert.ok(isGenerated(o.content), `${o.path} carries the marker`);
  // Frontmatter must be the very first line where tools require it
  for (const p of ['.cursor/rules/cortex.mdc', '.windsurf/rules/cortex.md', '.kiro/steering/cortex.md', '.agents/rules/cortex.md']) {
    assert.ok(r.outputs.find(o => o.path === p).content.startsWith('---\n'), p);
  }
});

test('shared AGENTS.md: tools that read it natively get no duplicate always-on file', () => {
  const r = compile({ ruleFiles: [{ path: 'p.md', content: '- a rule\n' }], config: { providers: all } });
  for (const id of ['cursor', 'copilot', 'windsurf', 'kiro', 'antigravity']) {
    assert.equal(r.report[id].viaAgentsMd, true, id);
    assert.ok(!r.outputs.some(o => o.path === TARGETS[id].mainFile), id);
  }
  assert.ok(r.outputs.some(o => o.path === 'CLAUDE.md'));
  assert.ok(r.outputs.some(o => o.path === 'GEMINI.md'));
});

test('scoped rules compile to each tool’s native scoping syntax', () => {
  const r = compile({
    ruleFiles: [{ path: 'react.md', content: '---\nscope: ["src/**/*.tsx"]\n---\n## C\n- small components\n' }],
    config: { providers: { claude: true, cursor: true, copilot: true, kiro: true, windsurf: true, codex: true }, output: { agentsMd: 'duplicate' } },
  });
  const get = p => r.outputs.find(o => o.path === p)?.content || '';
  assert.match(get('.claude/rules/cortex-react.md'), /paths:\n {2}- "src\/\*\*\/\*\.tsx"/);
  assert.match(get('.cursor/rules/cortex-react.mdc'), /globs: src\/\*\*\/\*\.tsx\nalwaysApply: false/);
  assert.match(get('.github/instructions/cortex-react.instructions.md'), /applyTo: "src\/\*\*\/\*\.tsx"/);
  assert.match(get('.kiro/steering/cortex-react.md'), /inclusion: fileMatch\nfileMatchPattern: "src\/\*\*\/\*\.tsx"/);
  assert.match(get('.windsurf/rules/cortex-react.md'), /trigger: glob\nglobs: src\/\*\*\/\*\.tsx/);
  assert.match(get('AGENTS.md'), /When working on `src\/\*\*\/\*\.tsx`/);
});

test('hard budgets keep whole rules, keep criticals, and report drops', () => {
  const lines = ['## Style'];
  for (let i = 0; i < 400; i++) lines.push(`- Style rule number ${i} with some padding text to take up space in the file`);
  lines.push('## Safety', '- ! Never commit secrets');
  const r = compile({ ruleFiles: [{ path: 'p.md', content: lines.join('\n') }], config: { providers: { windsurf: true } } });
  const out = r.outputs.find(o => o.path === '.windsurf/rules/cortex.md');
  assert.ok(measure(out.content, 'chars') <= 12000, `size ${out.content.length}`);
  assert.match(out.content, /Never commit secrets/);
  assert.ok(r.report.windsurf.dropped.length > 0);
  assert.ok(!/Truncated/.test(out.content));
});

test('fitRules never exceeds the limit and keeps original order', () => {
  const rules = Array.from({ length: 50 }, (_, i) => ({ text: `rule ${i} ${'x'.repeat(40)}`, category: i % 2 ? 'style' : 'security' }));
  const render = list => list.map(r => `- ${r.text}`).join('\n');
  const fit = fitRules(rules, { unit: 'chars', limit: 600 }, render);
  assert.ok(render(fit.kept).length <= 600);
  const idx = fit.kept.map(r => rules.indexOf(r));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  assert.ok(fit.kept.every(r => r.category === 'security'), 'security outranks style');
});

test('model override changes formatting style', () => {
  const base = { ruleFiles: [{ path: 'p.md', content: '## A\n- one\n- two\n' }] };
  const gpt = compile({ ...base, config: { providers: { cursor: { enabled: true, model: 'gpt-6.1-sol' } } } });
  assert.match(gpt.outputs[0].content, /1\. one\n2\. two/);
  const claude = compile({ ...base, config: { providers: { cursor: { enabled: true, model: 'claude-sonnet-5-5' } } } });
  assert.match(claude.outputs[0].content, /<a>\n- one/);
});

test('aliases and unknown providers', () => {
  assert.equal(resolveTargetId('agents'), 'codex');
  assert.equal(resolveTargetId('devin'), 'windsurf');
  assert.equal(resolveTargetId('nope'), null);
  const r = compile({ ruleFiles: [], config: { providers: { aider: true } } });
  assert.match(r.warnings[0], /Unknown provider "aider"/);
});

test('command catalog matches command modules on disk', () => {
  const files = new Set(readdirSync(new URL('../../src/commands/', import.meta.url)).map(f => f.replace(/\.js$/, '')));
  for (const c of COMMANDS) assert.ok(files.has(c.name), `src/commands/${c.name}.js exists`);
});
