// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex suggest — intelligent rule suggestions based on project analysis.
 */

import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir, writeFileSafe } from '../utils/fs.js';
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
    process.exit(1);
  }

  const config = loadConfig(projectRoot);
  const currentRules = loadCurrentRules(cortexDir);

  if (subCommand === 'packs') {
    return showPacks();
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
    error('Usage: cortex suggest apply <pack-id>');
    process.exit(1);
  }

  const pack = getPack(packId);
  if (!pack) {
    error(`Unknown pack: ${packId}. Run \`cortex suggest packs\` to see available packs.`);
    process.exit(1);
  }

  heading(`Applying: ${pack.name}`);
  info(pack.description);
  console.log();

  const currentContent = new Set(currentRules.map(r => r.content.toLowerCase().trim()));
  const newRules = pack.rules.filter(r => !currentContent.has(r.content.toLowerCase().trim()));

  if (newRules.length === 0) {
    success('All rules from this pack are already in your project!');
    return;
  }

  info(`New rules to add: ${newRules.length} (${pack.rules.length - newRules.length} already exist)`);
  console.log();

  for (const rule of newRules) {
    dim(`  + [${rule.category}] ${rule.content}`);
  }
  console.log();

  if (dry) {
    warn('Dry run — no files written.');
    return;
  }

  // Write to .cortex/rules/<pack-id>.md
  const rulesPath = join(cortexDir, 'rules', `${packId}.md`);
  let content = `# ${pack.name}\n`;
  content += `# Source: ${pack.source || 'builtin'} pack\n\n`;

  const byCategory = {};
  for (const rule of newRules) {
    const cat = rule.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(rule.content);
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    content += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
    for (const item of items) {
      content += `- ${item}\n`;
    }
    content += '\n';
  }

  writeFileSafe(rulesPath, content, { force: true });
  success(`Added ${newRules.length} rules to .cortex/rules/${packId}.md`);
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
