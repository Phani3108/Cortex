// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex init — set up .cortex/ in a project (or ~/.cortex/ with --global).
 *
 * 1. Detects the stack (language, framework, package manager, test runner).
 * 2. Detects which AI tools are already in use and enables exactly those
 *    (falls back to Claude Code + AGENTS.md + Cursor + Copilot).
 * 3. Imports any hand-written instruction files, so the first compile
 *    never loses a line someone wrote by hand.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getCortexDir, writeFileSafe, findProjectRoot } from '../utils/fs.js';
import { heading, success, info, warn, fileCreated, fileSkipped, dryRun, dim } from '../utils/log.js';
import { getDefaultConfigString } from '../core/config.js';
import { getDefaultProfileString } from '../core/profile.js';
import { TARGETS, DETECTION, DEFAULT_TARGETS, TARGET_IDS } from '../engine/targets.js';
import { importExisting } from './import.js';

export default async function init({ values }) {
  if (values.global) return initGlobal(values);
  return initProject(values);
}

async function initProject({ force, dry, quiet }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const say = quiet ? () => {} : fn => fn();

  say(() => { heading('Initializing Cortex'); dim(projectRoot); });

  const stack = detectProject(projectRoot);
  const tools = detectTools(projectRoot);
  const enabled = tools.length ? [...new Set([...tools, 'codex'])] : DEFAULT_TARGETS;

  say(() => {
    if (stack.language) info(`Stack: ${[stack.language, stack.framework, stack.packageManager, stack.testRunner].filter(Boolean).join(' · ')}`);
    info(tools.length
      ? `AI tools found: ${tools.map(t => TARGETS[t].name).join(', ')} (+ AGENTS.md for every other agent)`
      : `No AI tool files found — enabling ${enabled.map(t => TARGETS[t].name).join(', ')}`);
  });

  const files = [
    {
      path: join(cortexDir, 'config.yaml'),
      content: getDefaultConfigString({
        project: { name: stack.name, language: stack.language, framework: stack.framework },
        providers: Object.fromEntries(TARGET_IDS.map(id => [id, enabled.includes(id)])),
      }),
    },
    { path: join(cortexDir, 'rules', 'project.md'), content: projectRulesTemplate(stack) },
    { path: join(cortexDir, 'skills', '.gitkeep'), content: '' },
  ];

  let created = 0;
  for (const file of files) {
    if (dry) { say(() => dryRun(`Would create ${file.path}`)); created++; continue; }
    if (writeFileSafe(file.path, file.content, { force })) { say(() => fileCreated(file.path)); created++; }
    else say(() => fileSkipped(file.path));
  }

  // Bring existing hand-written instructions into .cortex/ before anything is compiled
  const imported = importExisting(projectRoot, { dry });
  say(() => {
    for (const f of imported.found.filter(x => !x.skipped)) success(`Imported ${f.file} → ${f.dest}`);
  });

  if (!dry) updateGitignore(projectRoot);

  say(() => {
    console.log();
    if (!created) warn('.cortex/ already exists. Use --force to overwrite config.yaml and rules/project.md.');
    else success('Cortex is ready.');
    dim('Next:');
    dim('  1. Edit .cortex/rules/project.md (plain markdown bullets)');
    dim(imported.imported ? '  2. cortex compile --force   (replaces the imported originals with generated files)' : '  2. cortex compile');
    dim('  3. Commit .cortex/ and the generated files; run `cortex compile --check` in CI');
  });
}

async function initGlobal({ force, dry }) {
  const cortexDir = getCortexDir(null, true);
  heading('Initializing global Cortex profile');
  info(`Directory: ${cortexDir}`);

  const files = [
    { path: join(cortexDir, 'profile.yaml'), content: getDefaultProfileString() },
    { path: join(cortexDir, 'rules', '.gitkeep'), content: '' },
    { path: join(cortexDir, 'skills', '.gitkeep'), content: '' },
  ];
  let created = 0;
  for (const file of files) {
    if (dry) { dryRun(`Would create ${file.path}`); created++; continue; }
    if (writeFileSafe(file.path, file.content, { force })) { fileCreated(file.path); created++; }
    else fileSkipped(file.path);
  }
  console.log();
  if (created) success('Global profile initialized. Rules in ~/.cortex/rules apply to every project you compile.');
  else warn('All files already exist. Use --force to overwrite.');
}

/** Which AI tools does this repo already use? */
export function detectTools(root) {
  return TARGET_IDS.filter(id => (DETECTION[id] || []).some(p => existsSync(join(root, p))));
}

export function detectProject(root) {
  const result = { name: null, language: null, framework: null, packageManager: null, testRunner: null };
  const has = p => existsSync(join(root, p));

  if (has('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      result.name = pkg.name || null;
      result.language = has('tsconfig.json') || deps.typescript ? 'TypeScript' : 'JavaScript';
      const frameworks = [
        ['next', 'Next.js'], ['@remix-run/react', 'Remix'], ['nuxt', 'Nuxt'], ['@sveltejs/kit', 'SvelteKit'], ['astro', 'Astro'],
        ['@angular/core', 'Angular'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['react', 'React'],
        ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify'], ['hono', 'Hono'], ['express', 'Express'],
      ];
      result.framework = frameworks.find(([dep]) => deps[dep])?.[1] || null;
      result.testRunner = ['vitest', 'jest', 'mocha', '@playwright/test'].find(d => deps[d]) || null;
    } catch { /* unreadable package.json */ }
    result.packageManager = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : has('package-lock.json') ? 'npm' : null;
  } else if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) {
    result.language = 'Python';
    const py = [has('pyproject.toml') && readFileSync(join(root, 'pyproject.toml'), 'utf-8'), has('requirements.txt') && readFileSync(join(root, 'requirements.txt'), 'utf-8')].filter(Boolean).join('\n').toLowerCase();
    result.framework = has('manage.py') || py.includes('django') ? 'Django' : py.includes('fastapi') ? 'FastAPI' : py.includes('flask') ? 'Flask' : null;
    result.packageManager = has('uv.lock') ? 'uv' : has('poetry.lock') ? 'poetry' : 'pip';
    result.testRunner = py.includes('pytest') ? 'pytest' : null;
  } else if (has('go.mod')) {
    result.language = 'Go';
  } else if (has('Cargo.toml')) {
    result.language = 'Rust';
  } else if (has('Gemfile')) {
    result.language = 'Ruby';
    if (has('config/application.rb')) result.framework = 'Rails';
  } else if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    result.language = has('build.gradle.kts') ? 'Kotlin' : 'Java';
    const build = ['pom.xml', 'build.gradle', 'build.gradle.kts'].filter(has).map(f => readFileSync(join(root, f), 'utf-8')).join('\n');
    if (build.includes('spring-boot')) result.framework = 'Spring Boot';
  } else if (has('composer.json')) {
    result.language = 'PHP';
    if (has('artisan')) result.framework = 'Laravel';
  }
  return result;
}

function projectRulesTemplate(stack) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, '..', '..', 'templates', 'rules', 'default.md');
  let text = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : '# Project Rules\n';
  const stackRules = [];
  if (stack.packageManager) stackRules.push(`- Use ${stack.packageManager} for dependencies and scripts; don't mix package managers`);
  if (stack.testRunner) stackRules.push(`- Tests use ${stack.testRunner}; run them before calling a change done`);
  if (stack.language === 'TypeScript') stackRules.push('- TypeScript strict mode: no `any` without a comment explaining why');
  if (stackRules.length) text = text.trimEnd() + `\n\n## Stack\n${stackRules.join('\n')}\n`;
  return text;
}

/**
 * Keep machine-local Cortex state out of git. Generated tool files are NOT
 * ignored: cloud agents (Copilot, Codex, Claude Code on the web) read them
 * straight from the repository, so they must be committed.
 */
function updateGitignore(projectRoot) {
  if (!existsSync(join(projectRoot, '.git'))) return;
  const gitignorePath = join(projectRoot, '.gitignore');
  const marker = '# Cortex — machine-local state (commit .cortex/ sources and the generated files)';
  const entries = [
    marker,
    '.cortex/.compile-manifest.json',
    '.cortex/session.json',
    '.cortex/adaptations.yaml',
    '.cortex/history/',
    '.cortex/.sync-cache/',
  ];
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (existing.includes(marker)) return;
  const legacy = existing.replace(/# cortex — auto-generated provider files[\s\S]*?(?:\n\n|$)/, '');
  writeFileSync(gitignorePath, (legacy.trimEnd() ? legacy.trimEnd() + '\n\n' : '') + entries.join('\n') + '\n', 'utf-8');
  dim('Updated .gitignore (Cortex machine-local state)');
}
