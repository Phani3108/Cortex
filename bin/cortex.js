#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * cortex — one source of rules, compiled to every AI coding tool.
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { COMMANDS, COMMAND_GROUPS, OPTIONS_HELP } from '../src/engine/commands.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const VERSION = pkg.version;

const OPTIONS = {
  help:     { type: 'boolean', short: 'h', default: false },
  version:  { type: 'boolean', short: 'v', default: false },
  global:   { type: 'boolean', short: 'g', default: false },
  force:    { type: 'boolean', short: 'f', default: false },
  dry:      { type: 'boolean', default: false },
  check:    { type: 'boolean', default: false },
  quiet:    { type: 'boolean', short: 'q', default: false },
  auto:     { type: 'boolean', default: false },
  yes:      { type: 'boolean', short: 'y', default: false },
  json:     { type: 'boolean', default: false },
  missing:  { type: 'boolean', default: false },
  strict:   { type: 'boolean', default: false },
  provider: { type: 'string',  short: 'p' },
  model:    { type: 'string',  short: 'm' },
  source:   { type: 'string' },
  glob:     { type: 'string' },
  sessions: { type: 'string' },
};

let values, positionals;
try {
  ({ values, positionals } = parseArgs({ allowPositionals: true, options: OPTIONS }));
} catch (err) {
  console.error(`${err.message}\nRun 'cortex --help' for available commands and options.`);
  process.exit(2);
}

const KNOWN = new Set(COMMANDS.map(c => c.name));

async function main() {
  if (values.version) {
    console.log(`cortex v${VERSION} — created by Phani Marupaka (https://linkedin.com/in/phani-marupaka)`);
    return;
  }
  const command = positionals[0];
  if (values.help || command === 'help') {
    printHelp(positionals[command === 'help' ? 1 : 0]);
    return;
  }

  // No command? Launch the guided assistant.
  if (!command) {
    const mod = await import('../src/commands/assist.js');
    await mod.default({ values, positionals: [] });
    return;
  }

  if (!KNOWN.has(command)) {
    const near = [...KNOWN].find(k => k.startsWith(command.slice(0, 3)));
    console.error(`Unknown command: ${command}${near ? ` — did you mean '${near}'?` : ''}\nRun 'cortex --help' for available commands.`);
    process.exit(2);
  }

  const mod = await import(`../src/commands/${command}.js`);
  await mod.default({ values, positionals: positionals.slice(1) });
}

function printHelp(topic) {
  const cmd = topic && COMMANDS.find(c => c.name === topic);
  if (cmd) {
    console.log(`\n  cortex ${cmd.name} — ${cmd.summary}\n\n  EXAMPLES\n${cmd.examples.map(e => `    ${e}`).join('\n')}\n`);
    return;
  }
  const lines = [`\n  cortex v${VERSION} — one source of rules for every AI coding tool`, '  https://cortex1.vercel.app', '', '  USAGE', '    cortex <command> [options]', ''];
  for (const group of COMMAND_GROUPS) {
    lines.push(`  ${group.title.toUpperCase()}`);
    for (const c of COMMANDS.filter(x => x.group === group.id)) lines.push(`    ${c.name.padEnd(10)} ${c.summary}`);
    lines.push('');
  }
  lines.push('  OPTIONS');
  for (const [flag, desc] of OPTIONS_HELP) lines.push(`    ${flag.padEnd(22)} ${desc}`);
  lines.push('', '  QUICK START', '    cortex init               # detect tools, import existing files', '    cortex compile            # write CLAUDE.md, AGENTS.md, .cursor/rules, …', '    cortex compile --check    # in CI: fail when generated files drift', '', "  Run 'cortex help <command>' for examples.", '');
  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
