// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Source discovery — reads .cortex/ (and ~/.cortex/) from disk and hands
 * plain { path, content } records to the pure engine.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getCortexDir } from '../utils/fs.js';
import { compile } from '../engine/compile.js';
import { loadConfig } from './config.js';
import { loadProfile } from './profile.js';

const TEXT = /\.(md|mdx|txt)$/i;

/** Recursively list rule files (sorted for deterministic output). */
function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

/** Rule files: .cortex/rules/**\/*.md */
export function loadRuleFiles(cortexDir, label = '.cortex') {
  const dir = join(cortexDir, 'rules');
  return listFiles(dir, f => TEXT.test(f)).map(full => ({
    path: `${label}/rules/${relative(dir, full).split('\\').join('/')}`,
    content: readFileSync(full, 'utf-8'),
  }));
}

/** Skill files: .cortex/skills/<name>.md or .cortex/skills/<name>/SKILL.md */
export function loadSkillFiles(cortexDir, label = '.cortex') {
  const dir = join(cortexDir, 'skills');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const skillMd = join(full, 'SKILL.md');
      if (existsSync(skillMd)) out.push({ path: `${label}/skills/${name}/SKILL.md`, content: readFileSync(skillMd, 'utf-8'), name });
    } else if (TEXT.test(name)) {
      out.push({ path: `${label}/skills/${name}`, content: readFileSync(full, 'utf-8') });
    }
  }
  return out;
}

/**
 * Personal style from ~/.cortex/profile.yaml → a few natural-language rules.
 * Only explicit, non-default preferences are included.
 */
export function profileRules(profile) {
  if (!profile?._exists) return [];
  const rules = [];
  const add = text => rules.push({ text, category: 'personal style', label: 'Personal style', priority: 'normal', scope: null, source: '~/.cortex/profile.yaml' });
  const style = profile.style || {};
  if (style.tone === 'concise') add('Be concise and direct; skip filler.');
  else if (style.tone === 'detailed') add('Explain reasoning in detail when proposing changes.');
  if (style.comments === 'minimal') add('Add comments only where the logic is not self-evident.');
  else if (style.comments === 'thorough') add('Document non-trivial functions with clear comments.');
  if (style.verbosity === 'brief') add('Keep answers brief unless asked for more.');
  for (const pref of profile.rules || []) if (typeof pref === 'string' && pref.trim()) add(pref.trim());
  return rules;
}

/**
 * Load everything and compile. Shared by compile / verify / diff / status.
 * @returns engine result + { config, projectRoot }
 */
export function compileProject(projectRoot, { only = null } = {}) {
  const cortexDir = getCortexDir(projectRoot);
  const globalDir = getCortexDir(null, true);
  const config = loadConfig(projectRoot);
  const profile = loadProfile();

  const ruleFiles = [...loadRuleFiles(globalDir, '~/.cortex'), ...loadRuleFiles(cortexDir)];
  // Project skills first: on a name clash the project's version wins.
  const skillFiles = [...loadSkillFiles(cortexDir), ...loadSkillFiles(globalDir, '~/.cortex')];

  const result = compile({
    ruleFiles,
    skillFiles,
    config,
    extraRules: profileRules(profile),
    only,
  });
  return { ...result, config, ruleFiles, skillFiles, projectRoot };
}
