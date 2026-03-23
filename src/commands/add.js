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

export default async function add({ values, positionals }) {
  const type = positionals[0]; // skill, rule, source
  const name = positionals[1];

  if (!type || !name) {
    printAddHelp();
    return;
  }

  const isGlobal = values.global;
  const force = values.force;
  const dry = values.dry;
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot, isGlobal);

  if (!existsSync(cortexDir)) {
    error(`${isGlobal ? '~/.cortex/' : '.cortex/'} not found. Run \`cortex init${isGlobal ? ' --global' : ''}\` first.`);
    process.exit(1);
  }

  switch (type) {
    case 'skill':
      return addSkill(cortexDir, name, { force, dry, isGlobal });
    case 'rule':
      return addRule(cortexDir, name, { force, dry, isGlobal });
    default:
      error(`Unknown type: ${type}. Use 'skill' or 'rule'.`);
      process.exit(1);
  }
}

function addSkill(cortexDir, name, { force, dry, isGlobal }) {
  const fileName = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = join(cortexDir, 'skills', fileName);

  heading(`Adding skill: ${name}`);

  const content = `# Skill: ${name}
# Created by cortex add skill

## Purpose
Describe what this skill does.

## Instructions
Detailed instructions for the AI assistant when this skill is active.

## Examples
Provide examples of expected behavior.
`;

  if (dry) {
    info(`Would create: ${filePath}`);
    return;
  }

  const created = writeFileSafe(filePath, content, { force });
  if (created) {
    fileCreated(filePath);
    success(`Skill '${name}' added${isGlobal ? ' (global)' : ''}`);
    dim('Edit the file to add your skill instructions, then run `cortex compile`');
  } else {
    warn(`${filePath} already exists. Use --force to overwrite.`);
  }
}

function addRule(cortexDir, name, { force, dry, isGlobal }) {
  const fileName = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = join(cortexDir, 'rules', fileName);

  heading(`Adding rule: ${name}`);

  const content = `# Rule: ${name}
# Created by cortex add rule

## Guidelines
Add your rules here. These will be compiled into all enabled provider configs.

- Rule 1
- Rule 2
- Rule 3
`;

  if (dry) {
    info(`Would create: ${filePath}`);
    return;
  }

  const created = writeFileSafe(filePath, content, { force });
  if (created) {
    fileCreated(filePath);
    success(`Rule '${name}' added${isGlobal ? ' (global)' : ''}`);
    dim('Edit the file to add your rules, then run `cortex compile`');
  } else {
    warn(`${filePath} already exists. Use --force to overwrite.`);
  }
}

function printAddHelp() {
  console.log(`
  cortex add — Add a new skill, rule, or source

  USAGE
    cortex add skill <name>     Create a new skill template
    cortex add rule <name>      Create a new rule template

  OPTIONS
    -g, --global               Add to global config (~/.cortex/)
    -f, --force                Overwrite if exists
    --dry                      Show what would be created

  EXAMPLES
    cortex add skill code-review
    cortex add rule security --global
    cortex add skill testing --dry
`);
}
