// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex add — Add a new skill, rule, or source.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { findProjectRoot, getCortexDir, writeFileSafe } from '../utils/fs.js';
import { heading, info, warn, error, success, dim, fileCreated } from '../utils/log.js';

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const SKILL_NAME = /^[a-z0-9-]{1,64}$/;

export default async function add({ values, positionals }) {
  const type = positionals[0]; // skill, rule
  const rawName = positionals[1];

  if (!type || !rawName) {
    printAddHelp();
    return;
  }

  if (type !== 'skill' && type !== 'rule') {
    error(`Unknown type: ${type}. Use 'skill' or 'rule'.`);
    process.exitCode = 1;
    return;
  }

  const check = validateName(type, rawName);
  if (check.error) {
    error(check.error);
    process.exitCode = 1;
    return;
  }

  const isGlobal = values.global;
  const force = values.force;
  const dry = values.dry;
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot, isGlobal);

  if (!existsSync(cortexDir)) {
    error(`${isGlobal ? '~/.cortex/' : '.cortex/'} not found. Run \`cortex init${isGlobal ? ' --global' : ''}\` first.`);
    process.exitCode = 1;
    return;
  }

  const opts = { force, dry, isGlobal };
  if (type === 'skill') return addSkill(cortexDir, check.name, opts);
  return addRule(cortexDir, check.name, { ...opts, globs: toList(values.glob) });
}

/**
 * Validate a user-supplied rule/skill name. Returns { name } or { error }.
 * Names are lowercased; a trailing .md is ignored.
 */
export function validateName(type, raw) {
  const name = String(raw || '').trim().toLowerCase().replace(/\.md$/, '');
  if (!SAFE_NAME.test(name) || name.includes('..')) {
    return { error: `Invalid ${type} name "${raw}". Use lowercase letters, digits, ".", "_" or "-" (e.g. api-design).` };
  }
  if (type === 'skill' && !SKILL_NAME.test(name)) {
    return { error: `Invalid skill name "${raw}". Skill names must be 1-64 lowercase letters, digits or hyphens (e.g. code-review).` };
  }
  return { name };
}

/** Agent Skills–style skill file: frontmatter name + description, then the body. */
export function skillTemplate(name) {
  const description = `Describe what the ${name} skill does and when the AI should use it.`.slice(0, 1024);
  return `---
name: ${name}
description: ${description}
---
# ${titleCase(name)}

## Purpose
Describe what this skill does.

## Instructions
Detailed instructions for the AI assistant when this skill is active.

## Examples
Provide examples of expected behavior.
`;
}

/** Rule file, optionally path-scoped via `scope:` frontmatter. */
export function ruleTemplate(name, globs = []) {
  const front = globs.length ? `---\nscope: [${globs.map(g => JSON.stringify(g)).join(', ')}]\n---\n` : '';
  return `${front}# ${titleCase(name)}

## Guidelines
<!-- Add your rules here. They are compiled into all enabled provider configs. -->
- Rule 1
- Rule 2
- Rule 3
`;
}

function addSkill(cortexDir, name, { force, dry, isGlobal }) {
  const filePath = join(cortexDir, 'skills', `${name}.md`);
  const dirSkill = join(cortexDir, 'skills', name, 'SKILL.md');

  heading(`Adding skill: ${name}`);

  if (existsSync(dirSkill) && !force) {
    warn(`${dirSkill} already exists. Use --force to create ${name}.md anyway.`);
    return;
  }

  if (dry) {
    info(`Would create: ${filePath}`);
    return;
  }

  const created = writeFileSafe(filePath, skillTemplate(name), { force });
  if (created) {
    fileCreated(filePath);
    success(`Skill '${name}' added${isGlobal ? ' (global)' : ''}`);
    dim('Edit the description and instructions, then run `cortex compile`');
  } else {
    warn(`${filePath} already exists. Use --force to overwrite.`);
  }
}

function addRule(cortexDir, name, { force, dry, isGlobal, globs }) {
  const filePath = join(cortexDir, 'rules', `${name}.md`);

  heading(`Adding rule: ${name}`);

  if (dry) {
    info(`Would create: ${filePath}${globs.length ? ` (scope: ${globs.join(', ')})` : ''}`);
    return;
  }

  const created = writeFileSafe(filePath, ruleTemplate(name, globs), { force });
  if (created) {
    fileCreated(filePath);
    success(`Rule '${name}' added${isGlobal ? ' (global)' : ''}${globs.length ? ` for ${globs.join(', ')}` : ''}`);
    dim('Edit the file to add your rules, then run `cortex compile`');
  } else {
    warn(`${filePath} already exists. Use --force to overwrite.`);
  }
}

function toList(value) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map(v => String(v).trim()).filter(Boolean);
}

function titleCase(name) {
  return name.split(/[-_.]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function printAddHelp() {
  console.log(`
  cortex add — Add a new skill, rule, or source

  USAGE
    cortex add skill <name>     Create a new skill template
    cortex add rule <name>      Create a new rule template
    cortex add rule <name> --glob "src/**/*.tsx"
                                Rule that only applies to matching paths

  OPTIONS
    -g, --global               Add to global config (~/.cortex/)
    -f, --force                Overwrite if exists
    --dry                      Show what would be created

  EXAMPLES
    cortex add skill code-review
    cortex add skill stack-selection
    cortex add skill agent-foundations
    cortex add skill mcp-builder
    cortex add skill api-contract-engineering
    cortex add skill tutorial-coach
    cortex add rule security --global
    cortex add skill testing --dry
`);
}
