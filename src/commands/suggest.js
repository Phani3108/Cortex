// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex suggest — intelligent rule suggestions based on project analysis.
 */

import { join, relative } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir, writeFileSafe, readFileSafe } from '../utils/fs.js';
import { mergeBullets } from '../core/adapt.js';
import { loadConfig } from '../core/config.js';
import { suggestRules, suggestMissingRules, listPacks, getPack } from '../core/community.js';
import { heading, info, success, warn, dim, table, error } from '../utils/log.js';

export default async function suggest({ values, positionals }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const subCommand = positionals[0]; // 'packs', 'rules', 'apply', or empty
  const dry = values.dry;

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(projectRoot);
  const currentRules = loadCurrentRules(cortexDir);

  if (subCommand === 'packs') {
    return showPacks();
  }

  if (subCommand === 'apply' && values.missing) {
    return applyMissing(projectRoot, cortexDir, currentRules, config, dry);
  }
  if (subCommand === 'apply') {
    return applyPack(positionals[1], cortexDir, currentRules, dry);
  }

  // Default: show suggestions
  heading('Rule Suggestions');
  info(`Project: ${projectRoot}`);
  info(`Current rules: ${currentRules.length}`);
  console.log();

  // Pack suggestions
  const packSuggestions = suggestRules(projectRoot, currentRules, config);
  if (packSuggestions.length > 0) {
    info('RECOMMENDED RULE PACKS:');
    console.log();
    for (const s of packSuggestions) {
      const relevancePct = Math.round(s.relevance * 100);
      info(`  ${s.pack.name} (${relevancePct}% relevant)`);
      dim(`    ${s.pack.description}`);
      dim(`    Reason: ${s.reason}`);
      dim(`    New rules: ${s.newRules.length} (${s.existingRuleOverlap} already covered)`);
      dim(`    Apply: cortex suggest apply ${s.pack.id}`);
      console.log();
    }
  } else {
    info('No pack suggestions — your rules cover the detected stack well.');
    console.log();
  }

  // Individual rule suggestions
  const missing = suggestMissingRules(projectRoot, currentRules, config);
  if (missing.length > 0) {
    info('SUGGESTED INDIVIDUAL RULES:');
    console.log();
    for (const rule of missing) {
      dim(`  + "${rule.content}"`);
      dim(`    Category: ${rule.category} | Reason: ${rule.reason}`);
      console.log();
    }
    dim(`  Add these with: cortex suggest apply --missing`);
  } else {
    info('No individual rule gaps detected.');
  }

  console.log();
  success(`Analysis complete. ${packSuggestions.length} pack(s) and ${missing.length} individual rule(s) suggested.`);
}

function showPacks() {
  heading('Available Rule Packs');
  console.log();

  const packs = listPacks();
  const builtinPacks = packs.filter(p => p.source === 'builtin');
  const communityPacks = packs.filter(p => p.source === 'community');

  info('BUILT-IN PACKS:');
  const rows = builtinPacks.map(p => [
    p.id,
    p.name,
    `${p.ruleCount} rules`,
    p.tags.slice(0, 3).join(', '),
  ]);
  if (rows.length > 0) table(rows);

  if (communityPacks.length > 0) {
    console.log();
    info('COMMUNITY PACKS:');
    const cRows = communityPacks.map(p => [
      p.id,
      p.name,
      `${p.ruleCount} rules`,
      p.author || '',
    ]);
    table(cRows);
  }

  console.log();
  dim('Apply: cortex suggest apply <pack-id>');
  dim('Preview: cortex suggest apply <pack-id> --dry');
}

function applyPack(packId, cortexDir, currentRules, dry) {
  if (!packId) {
    error('Usage: cortex suggest apply <pack-id>  (or: cortex suggest apply --missing)');
    process.exitCode = 1;
    return;
  }

  const pack = getPack(packId);
  if (!pack) {
    error(`Unknown pack: ${packId}. Run \`cortex suggest packs\` to see available packs.`);
    process.exitCode = 1;
    return;
  }

  const fileId = String(pack.id || packId).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-._]+/, '');
  if (!fileId) {
    error(`Pack id "${packId}" cannot be used as a file name.`);
    process.exitCode = 1;
    return;
  }

  heading(`Applying: ${pack.name}`);
  info(pack.description);
  console.log();

  writeRules({
    rules: pack.rules,
    currentRules,
    path: join(cortexDir, 'rules', `${fileId}.md`),
    title: pack.name,
    intro: `Source: ${pack.source || 'builtin'} pack (cortex suggest apply ${fileId})`,
    dry,
    emptyMessage: 'All rules from this pack are already in your project!',
  });
}

function applyMissing(projectRoot, cortexDir, currentRules, config, dry) {
  heading('Applying suggested rules');
  const missing = suggestMissingRules(projectRoot, currentRules, config);
  writeRules({
    rules: missing,
    currentRules,
    path: join(cortexDir, 'rules', 'suggested.md'),
    title: 'Suggested Rules',
    intro: 'Added by `cortex suggest apply --missing` — edit or remove as needed.',
    dry,
    emptyMessage: 'No individual rule gaps detected.',
  });
}

/** Merge rules into a rules file, keeping anything already there. */
function writeRules({ rules, currentRules, path, title, intro, dry, emptyMessage }) {
  const currentContent = new Set(currentRules.map(r => r.content.toLowerCase().trim()));
  const newRules = rules.filter(r => !currentContent.has(String(r.content).toLowerCase().trim()));

  if (newRules.length === 0) {
    success(emptyMessage);
    return;
  }

  const byCategory = new Map();
  for (const rule of newRules) {
    const cat = rule.category || 'general';
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label).push(rule.content);
  }
  const sections = [...byCategory].map(([heading, items]) => ({ heading, items }));
  const merged = mergeBullets(readFileSafe(path), { title, intro, sections });

  if (merged.added.length === 0) {
    success(emptyMessage);
    return;
  }

  info(`New rules to add: ${merged.added.length} (${rules.length - merged.added.length} already exist)`);
  console.log();
  for (const item of merged.added) dim(`  + ${item}`);
  console.log();

  if (dry) {
    warn('Dry run — no files written.');
    return;
  }

  writeFileSafe(path, merged.content, { force: true });
  success(`Added ${merged.added.length} rule(s) to ${relative(process.cwd(), path) || path}`);
  dim('Run `cortex compile` to apply to all providers.');
}

function loadCurrentRules(cortexDir) {
  const rulesDir = join(cortexDir, 'rules');
  if (!existsSync(rulesDir)) return [];
  const rules = [];
  for (const file of readdirSync(rulesDir)) {
    if (file.startsWith('.') || (!file.endsWith('.md') && !file.endsWith('.txt'))) continue;
    const content = readFileSync(join(rulesDir, file), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && trimmed.length > 5) {
        rules.push({ content: trimmed.slice(2).trim(), source: file });
      }
    }
  }
  return rules;
}
