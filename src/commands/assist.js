// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex assist — the conversational assistant command.
 *
 * This is the "friendly front door" to cortex. Instead of reading docs
 * or memorizing CLI commands, users run `cortex assist` and get guided
 * through whatever they need.
 *
 * It asks questions, suggests the best path, lets the user choose,
 * executes the action, and remembers everything for next time.
 *
 * Usage:
 *   cortex assist              — Start/continue the guided conversation
 *   cortex assist summary      — Show project impact numbers
 *   cortex assist reset        — Reset session (start fresh)
 */

import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { loadConfig, saveConfig } from '../core/config.js';
import { loadProfile, saveProfile } from '../core/profile.js';
import { loadSession, saveSession, recordAction, updateMetrics } from '../core/session.js';
import { startConversation, closeReadline } from '../core/assistant.js';
import { generateSummary, calculateSavings } from '../core/metrics.js';
import { heading, info, success, warn, dim, error } from '../utils/log.js';

export default async function assist({ values, positionals }) {
  const projectRoot = findProjectRoot();
  const subcommand = positionals[0];

  // Quick subcommands
  if (subcommand === 'summary' || subcommand === 'report') {
    return showSummary(projectRoot);
  }
  if (subcommand === 'reset') {
    return resetSession(projectRoot);
  }

  // Main conversation flow
  const result = await startConversation(projectRoot);

  if (!result) return; // User exited or no action needed

  // Execute the chosen action
  const session = loadSession(projectRoot);

  switch (result.action) {
    case 'setup':
      await executeSetup(projectRoot, result, session);
      break;

    case 'compile':
      await executeCompile(projectRoot, session, values);
      break;

    case 'learn':
      await executeLearn(projectRoot, session, values);
      break;

    case 'summary':
    case 'report':
      showSummary(projectRoot);
      break;

    case 'add_providers':
      await executeAddProviders(projectRoot, session);
      break;

    case 'set_language':
      await executeSetLanguage(projectRoot, session);
      break;

    case 'add_rules':
      info('Run `cortex add rule <name>` to create a new rule file, or');
      dim('copy a template from .cortex/templates/rules/ into .cortex/rules/');
      break;

    case 'add_skills':
      await executeAddSkills(projectRoot, session);
      break;

    case 'add':
      info('Run `cortex add skill <name>` or `cortex add rule <name>`');
      break;

    default:
      // Try to run as a command
      try {
        const mod = await import(`./${result.action}.js`);
        await mod.default({ values, positionals: [] });
      } catch {
        dim(`Action "${result.action}" — run \`cortex ${result.action}\` to execute.`);
      }
  }

  // Final save
  saveSession(session);

  // Post-action suggestion
  console.log();
  dim('Run `cortex assist` again for next steps, or `cortex assist summary` for impact numbers.');
}

// ── Action Executors ────────────────────────────────────────────────────────

async function executeSetup(projectRoot, plan, session) {
  console.log();
  heading('Setting up cortex');

  // 1. Run init
  try {
    const initMod = await import('./init.js');
    await initMod.default({ values: { force: false }, positionals: [] });
  } catch (e) {
    // Init may already exist
  }

  // 2. Update config with chosen providers
  const config = loadConfig(projectRoot);
  if (plan.providers) {
    config.providers = { ...config.providers, ...plan.providers };
  }
  saveConfig(config, { force: true });
  recordAction(session, 'config_updated', { providers: plan.providers });

  // 3. Update profile
  const profile = loadProfile();
  if (plan.profile) {
    if (plan.profile.tone) profile.style.tone = plan.profile.tone;
    if (plan.profile.comments) profile.style.comments = plan.profile.comments;
  }
  saveProfile(profile, { force: true });
  recordAction(session, 'profile_updated', plan.profile);

  // 4. Compile
  await executeCompile(projectRoot, session, { force: true });

  console.log();
  success('Setup complete! Your AI tools are now configured.');

  const enabledCount = Object.values(plan.providers || {}).filter(Boolean).length;
  info(`${enabledCount} provider(s) configured and compiled.`);

  if (plan.goal === 'learning') {
    console.log();
    info('Next step: Run `cortex watch` to start the learning loop.');
    dim('It watches for changes and automatically learns from your edits.');
  } else if (plan.goal === 'team') {
    console.log();
    info('Next step: Commit .cortex/ to git so your team gets the same config.');
    dim('They just need to run `cortex compile` after pulling.');
  }
}

async function executeCompile(projectRoot, session, values) {
  try {
    const compileMod = await import('./compile.js');
    await compileMod.default({ values: { ...values, force: true }, positionals: [] });

    // Track metrics
    const config = loadConfig(projectRoot);
    const enabledProviders = Object.entries(config.providers || {})
      .filter(([, v]) => v).map(([k]) => k);

    updateMetrics(session, {
      compilations: 1,
      filesGenerated: enabledProviders.length * 2, // Rough estimate
      providersUsed: enabledProviders,
    });
    recordAction(session, 'compiled', { providers: enabledProviders });
  } catch (e) {
    error(`Compile failed: ${e.message}`);
  }
}

async function executeLearn(projectRoot, session, values) {
  try {
    const learnMod = await import('./learn.js');
    await learnMod.default({ values, positionals: [] });
    recordAction(session, 'learned');
  } catch (e) {
    error(`Learn failed: ${e.message}`);
  }
}

async function executeAddProviders(projectRoot, session) {
  const config = loadConfig(projectRoot);
  const disabled = Object.entries(PROVIDER_SPECS)
    .filter(([k]) => !config.providers?.[k])
    .map(([k, spec]) => ({ key: k, name: spec.name }));

  if (disabled.length === 0) {
    success('All providers are already enabled!');
    return;
  }

  info('Available providers to enable:');
  disabled.forEach((p, i) => {
    console.log(`    ${i + 1}) ${p.name} (${p.key})`);
  });
  console.log();

  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(r => rl.question('  Enable which? (numbers, comma-separated, or "all"): ', r));
  rl.close();

  let toEnable;
  if (answer.trim().toLowerCase() === 'all') {
    toEnable = disabled;
  } else {
    const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
    toEnable = indices.filter(i => i >= 0 && i < disabled.length).map(i => disabled[i]);
  }

  for (const p of toEnable) {
    config.providers[p.key] = true;
  }
  saveConfig(config, { force: true });

  success(`Enabled ${toEnable.length} provider(s): ${toEnable.map(p => p.name).join(', ')}`);
  info('Run `cortex compile` to generate their config files.');

  recordAction(session, 'providers_added', { added: toEnable.map(p => p.key) });
}

async function executeSetLanguage(projectRoot, session) {
  const { detectProject } = await import('./init.js').catch(() => ({}));
  const config = loadConfig(projectRoot);

  // Try auto-detection from known files
  const detected = {};
  if (existsSync(`${projectRoot}/package.json`)) {
    detected.language = 'javascript';
    if (existsSync(`${projectRoot}/tsconfig.json`)) detected.language = 'typescript';
    try {
      const pkg = JSON.parse(require('node:fs').readFileSync(`${projectRoot}/package.json`, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react || deps.next) detected.framework = 'React';
      else if (deps.vue) detected.framework = 'Vue';
      else if (deps.svelte) detected.framework = 'Svelte';
      else if (deps.express) detected.framework = 'Express';
      else if (deps.fastify) detected.framework = 'Fastify';
    } catch {}
  } else if (existsSync(`${projectRoot}/pyproject.toml`) || existsSync(`${projectRoot}/setup.py`)) {
    detected.language = 'python';
  } else if (existsSync(`${projectRoot}/Cargo.toml`)) {
    detected.language = 'rust';
  } else if (existsSync(`${projectRoot}/go.mod`)) {
    detected.language = 'go';
  }

  if (detected.language) {
    config.project.language = detected.language;
    if (detected.framework) config.project.framework = detected.framework;
    saveConfig(config, { force: true });
    success(`Detected: ${detected.language}${detected.framework ? ` / ${detected.framework}` : ''}`);
    recordAction(session, 'language_set', detected);
  } else {
    warn('Could not auto-detect language. Edit .cortex/config.yaml manually.');
  }
}

async function executeAddSkills(projectRoot, session) {
  const availableSkills = ['code-review', 'security-audit', 'debugging', 'tdd'];

  info('Available skill templates:');
  availableSkills.forEach((s, i) => {
    console.log(`    ${i + 1}) ${s}`);
  });
  console.log();

  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(r => rl.question('  Add which? (numbers, comma-separated, or "all"): ', r));
  rl.close();

  let toAdd;
  if (answer.trim().toLowerCase() === 'all') {
    toAdd = availableSkills;
  } else {
    const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
    toAdd = indices.filter(i => i >= 0 && i < availableSkills.length).map(i => availableSkills[i]);
  }

  // Copy templates to .cortex/skills/
  const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const cortexDir = getCortexDir(projectRoot);
  const skillsDir = join(cortexDir, 'skills');
  mkdirSync(skillsDir, { recursive: true });

  // Template dir is relative to this module
  const thisFile = fileURLToPath(import.meta.url);
  const templatesDir = join(dirname(thisFile), '..', '..', 'templates', 'skills');

  for (const skill of toAdd) {
    const src = join(templatesDir, `${skill}.md`);
    const dest = join(skillsDir, `${skill}.md`);
    if (existsSync(src)) {
      const content = readFileSync(src, 'utf-8');
      writeFileSync(dest, content);
      success(`Added skill: ${skill}`);
    } else {
      warn(`Template not found: ${skill}`);
    }
  }

  if (toAdd.length > 0) {
    recordAction(session, 'skills_added', { skills: toAdd });
    updateMetrics(session, { skillsApplied: toAdd });
    info('Run `cortex compile` to include these skills in your provider files.');
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────

function showSummary(projectRoot) {
  const report = generateSummary(projectRoot);
  console.log();
  console.log(report);
  console.log();
}

function resetSession(projectRoot) {
  const sessionPath = join(getCortexDir(projectRoot), 'session.json');
  if (existsSync(sessionPath)) {
    unlinkSync(sessionPath);
    success('Session reset. Run `cortex assist` to start fresh.');
  } else {
    dim('No session to reset.');
  }
}

// Import PROVIDER_SPECS for use in executeAddProviders
import { PROVIDER_SPECS } from '../core/specs.js';
