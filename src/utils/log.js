// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Logging and output formatting utilities.
 */

const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  gray:    '\x1b[90m',
};

const NO_COLOR = process.env.NO_COLOR !== undefined;

function c(color, text) {
  return NO_COLOR ? text : `${COLORS[color]}${text}${COLORS.reset}`;
}

export function info(msg)    { console.log(c('cyan', '  ℹ'), msg); }
export function success(msg) { console.log(c('green', '  ✓'), msg); }
export function warn(msg)    { console.log(c('yellow', '  ⚠'), msg); }
export function error(msg)   { console.error(c('red', '  ✗'), msg); }
export function dim(msg)     { console.log(c('gray', `    ${msg}`)); }

export function heading(msg) {
  console.log();
  console.log(c('bold', `  ${msg}`));
  console.log(c('dim', `  ${'─'.repeat(msg.length)}`));
}

export function table(rows, indent = 4) {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, val] of rows) {
    console.log(`${' '.repeat(indent)}${c('cyan', key.padEnd(maxKey))}  ${val}`);
  }
}

export function fileCreated(path) {
  success(`Created ${c('bold', path)}`);
}

export function fileSkipped(path) {
  dim(`Skipped ${path} (already exists)`);
}

export function dryRun(msg) {
  console.log(c('magenta', '  [dry]'), msg);
}
