import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSamplesRoot } from '../../src/commands/tutorial.js';
import { gatherFiles, isExportable } from '../../src/commands/export.js';
import { loadSession, saveSession, recordDecision, recordRecommendation } from '../../src/core/session.js';
import { calculateSavings, generateSummary } from '../../src/core/metrics.js';
import { isProjectInitialized } from '../../src/core/assistant.js';
import { ROOT, gitRepo, tempDir, write, runCli, withTempHome } from './helpers.js';

test('tutorial samples resolve from the package, not the cwd', () => {
  assert.equal(getSamplesRoot(), join(ROOT, 'samples'));
  const elsewhere = tempDir();
  const res = runCli(elsewhere, ['tutorial', 'scaffold', 'lane-a', join(elsewhere, 'out'), '--dry']);
  assert.doesNotMatch(res.out, /Sample not found/);
});

test('profile reset --force restores defaults', () => {
  const home = tempDir('cortex-home-');
  write(home, '.cortex/profile.yaml', 'name: Someone\nstyle:\n  tone: detailed\npatterns:\n  - junk pattern\n');
  const cwd = tempDir();
  const res = runCli(cwd, ['profile', 'reset', '--force'], { home });
  assert.equal(res.code, 0, res.out);
  const text = readFileSync(join(home, '.cortex/profile.yaml'), 'utf-8');
  assert.doesNotMatch(text, /Someone|junk pattern|detailed/);
  assert.match(text, /tone: concise/);
});

test('export skips directories (except SKILL.md dirs) and internal state', () => {
  const root = tempDir();
  const skills = join(root, 'skills');
  write(skills, 'review.md', '# review');
  write(skills, 'deploy/SKILL.md', '---\nname: deploy\n---\n');
  mkdirSync(join(skills, 'empty-dir'));
  const files = gatherFiles(skills).map(f => f.file).sort();
  assert.deepEqual(files, ['deploy/SKILL.md', 'review.md']);

  assert.equal(isExportable('rules/a.md'), true);
  for (const internal of ['.compile-manifest.json', 'session.json', 'adaptations.yaml', 'history/x.json', '.sync-cache/r/a.md']) {
    assert.equal(isExportable(internal), false, internal);
  }

  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  write(repo, '.cortex/rules/a.md', '- rule');
  mkdirSync(join(repo, '.cortex/rules/subdir'));
  write(repo, '.cortex/session.json', '{}');
  write(repo, '.cortex/history/1.json', '{}');
  const res = runCli(repo, ['export']);
  assert.equal(res.code, 0, res.out);
  assert.ok(existsSync(join(repo, 'cortex-export/rules/a.md')));
  assert.ok(!existsSync(join(repo, 'cortex-export/session.json')));
  assert.ok(!existsSync(join(repo, 'cortex-export/history')));
});

test('session caps decisions and recommendations at 50', () => {
  const root = tempDir();
  const session = loadSession(root);
  for (let i = 0; i < 80; i++) {
    recordDecision(session, 'q', i);
    recordRecommendation(session, `r${i}`, true);
  }
  assert.equal(session.decisions.length, 50);
  assert.equal(session.recommendations.length, 50);
  assert.equal(session.decisions[49].choice, 79);
  saveSession(session);
  const reloaded = loadSession(root);
  assert.equal(reloaded.decisions.length, 50);
});

test('time saved is zero without recorded events and labelled as estimate', () => {
  const env = withTempHome();
  try {
    const root = tempDir();
    write(root, '.cortex/config.yaml', 'providers:\n  claude: true\n  cursor: true\n  copilot: true\n');
    const savings = calculateSavings(root);
    assert.equal(savings.time.totalSavedMinutes, 0);
    assert.equal(savings.time.estimate, true);

    const session = loadSession(root);
    session.metrics.filesGenerated = 10;
    session.metrics.rulesEvolved = 4;
    saveSession(session);
    assert.ok(calculateSavings(root).time.totalSavedMinutes > 0);
    assert.match(generateSummary(root), /estimate/i);
  } finally {
    env.restore();
  }
});

test('onboarding keys off .cortex/config.yaml, not just the directory', () => {
  const root = tempDir();
  mkdirSync(join(root, '.cortex'));
  assert.equal(isProjectInitialized(root), false);
  writeFileSync(join(root, '.cortex/config.yaml'), 'version: 1\n');
  assert.equal(isProjectInitialized(root), true);
});

test('suggest apply merges into an existing pack file', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  write(repo, '.cortex/rules/react-modern.md', '# React (mine)\n<!-- keep me -->\n- My own custom react rule here\n');
  const res = runCli(repo, ['suggest', 'apply', 'react-modern']);
  assert.equal(res.code, 0, res.out);
  const text = readFileSync(join(repo, '.cortex/rules/react-modern.md'), 'utf-8');
  assert.match(text, /<!-- keep me -->/);
  assert.match(text, /- My own custom react rule here/);
  assert.ok(text.split('\n').filter(l => l.startsWith('- ')).length > 1);

  const again = runCli(repo, ['suggest', 'apply', 'react-modern']);
  assert.equal(readFileSync(join(repo, '.cortex/rules/react-modern.md'), 'utf-8'), text);
  assert.match(again.out, /already/);
});

test('suggest apply --missing writes suggested rules without clobbering', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  write(repo, 'tsconfig.json', '{}');
  write(repo, 'package.json', JSON.stringify({ devDependencies: { typescript: '5', jest: '1' } }));
  const res = runCli(repo, ['suggest', 'apply', '--missing']);
  assert.equal(res.code, 0, res.out);
  const rulesDir = join(repo, '.cortex/rules');
  if (existsSync(join(rulesDir, 'suggested.md'))) {
    assert.match(readFileSync(join(rulesDir, 'suggested.md'), 'utf-8'), /^- /m);
  } else {
    assert.match(res.out, /No individual rule gaps/);
  }
  assert.ok(readdirSync(rulesDir).every(f => f.endsWith('.md')));
});
