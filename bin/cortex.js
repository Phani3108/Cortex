#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * cortex — Universal AI Context Engine CLI
 *
 * Carry your intelligence across every AI coding tool and every project.
 * One config layer that compiles to Claude, Cursor, Copilot, Gemini, OpenAI, and more.
 */

import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// ── CLI argument parsing ────────────────────────────────────────────────────
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help:    { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
    global:  { type: 'boolean', short: 'g', default: false },
    force:   { type: 'boolean', short: 'f', default: false },
    dry:     { type: 'boolean', default: false },
    provider:{ type: 'string',  short: 'p' },
    profile: { type: 'string' },
  },
});

const VERSION = '1.0.0';
const COMMANDS = {
  assist:   'Guided assistant — asks questions, suggests best path, remembers context',
  init:     'Initialize .cortex/ in the current project (or ~/.cortex/ with --global)',
  compile:  'Compile universal config to provider-specific files',
  learn:    'Capture signals from project and evolve AI context',
  watch:    'Continuously adapt as you work (auto-learn + auto-compile)',
  hooks:    'Install git hooks for automatic learning (hooks install|remove|status)',
  diff:     'Show what changed in provider files since last compile',
  import:   'Import existing provider files (CLAUDE.md, .cursorrules, etc.) into .cortex/',
  cost:     'Show estimated token cost analysis for the project',
  status:   'Show current cortex configuration status',
  profile:  'View or edit your personal AI profile (~/.cortex/profile.yaml)',
  add:      'Add a new skill, rule, or source (e.g., cortex add skill <name>)',
  sync:     'Sync skills/rules from upstream sources',
  update:   'Update cortex and upstream sources to latest versions',
  export:   'Export your context for sharing or backup',
};

// ── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  if (values.version) {
    console.log(`cortex v${VERSION} — Created by Phani Marupaka (https://linkedin.com/in/phani-marupaka)`);
    process.exit(0);
  }

  const command = positionals[0];

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // No command? Launch the guided assistant.
  if (!command) {
    const mod = await import('../src/commands/assist.js');
    await mod.default({ values, positionals: [] });
    process.exit(0);
  }

  if (!COMMANDS[command]) {
    console.error(`Unknown command: ${command}\nRun 'cortex --help' for available commands.`);
    process.exit(1);
  }

  // Dynamically import the command module
  try {
    // 'import' is a JS keyword, so handle the alias
    const cmdFile = command === 'import' ? 'import' : command;
    const mod = await import(`../src/commands/${cmdFile}.js`);
    await mod.default({ values, positionals: positionals.slice(1) });
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`Command '${command}' is not yet implemented.`);
      process.exit(1);
    }
    throw err;
  }
}

function printHelp() {
  console.log(`
  cortex v${VERSION} — Universal AI Context Engine
  Created by Phani Marupaka (https://linkedin.com/in/phani-marupaka)

  USAGE
    cortex <command> [options]

  COMMANDS
${Object.entries(COMMANDS).map(([k, v]) => `    ${k.padEnd(12)} ${v}`).join('\n')}

  OPTIONS
    -h, --help       Show this help message
    -v, --version    Show version
    -g, --global     Apply to global config (~/.cortex/)
    -f, --force      Overwrite existing files
    --dry            Dry run — show what would be done without writing
    -p, --provider   Target a specific provider (claude, cursor, copilot, gemini, openai)
    --profile        Path to custom profile file

  EXAMPLES
    cortex init                    Initialize AI context for current project
    cortex init --global           Set up your personal AI profile
    cortex compile                 Generate provider-specific configs
    cortex compile -p claude       Compile only for Claude Code
    cortex learn                   Capture signals and evolve context
    cortex learn --dry             Preview what would be learned
    cortex diff                    See what changed since last compile
    cortex import                  Import existing CLAUDE.md, .cursorrules, etc.
    cortex watch                   Auto-adapt as you work
    cortex hooks install           Install git hooks for auto-learning
    cortex sync                    Sync rules from remote sources
    cortex cost                    Analyze token cost for project context
    cortex add skill tdd           Add the TDD skill to current project
    cortex status                  Show current configuration

  LEARN MORE
    https://github.com/Phani3108/Cortex
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
