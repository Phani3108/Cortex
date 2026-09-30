// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex cost — what your always-on instructions cost in input tokens.
 *
 * Every session a tool re-sends its always-on file (CLAUDE.md, AGENTS.md, …).
 * This prices that per 1,000 sessions and per month on current models from
 * the registry.
 *
 *   cortex cost                   representative current models
 *   cortex cost -m gpt-6.1-sol    one model
 *   cortex cost --sessions 50     sessions per developer per day (default 20, × 22 working days)
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, info, warn, error, dim } from '../utils/log.js';
import { requireCortex, inspectProject } from '../core/health.js';
import { describeModel, representativeModels, formatUSD, formatPrice } from '../core/budget.js';
import { estimateTokens, formatTokens } from '../engine/index.js';

const WORKING_DAYS = 22;
const DEFAULT_SESSIONS = 20;

export default async function cost({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  const sessionsPerDay = Number(values.sessions) > 0 ? Number(values.sessions) : DEFAULT_SESSIONS;
  const perMonth = sessionsPerDay * WORKING_DAYS;

  let inspection;
  try {
    inspection = inspectProject(projectRoot);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  // Unique always-on files and the tools that load them
  const files = new Map();
  for (const t of Object.values(inspection.targets)) {
    const out = t.alwaysOnOutput;
    if (!out) continue;
    if (!files.has(out.path)) files.set(out.path, { path: out.path, content: out.content, usedBy: [] });
    files.get(out.path).usedBy.push(t.name);
  }

  const models = (values.model ? [values.model] : representativeModels()).map(describeModel);
  const rows = [...files.values()].map(f => ({
    path: f.path,
    usedBy: f.usedBy,
    models: models.map(m => {
      const tokens = estimateTokens(f.content, m.tokenizer);
      const price = m.input || 0;
      return {
        model: m.id,
        estimated: m.estimated,
        tokens,
        inputPer1M: m.input,
        cacheReadPer1M: m.cacheRead,
        per1kSessions: tokens * 1000 / 1e6 * price,
        perMonth: tokens * perMonth / 1e6 * price,
        perMonthCached: m.cacheRead !== null ? tokens * perMonth / 1e6 * m.cacheRead : null,
      };
    }),
  }));

  if (values.json) {
    console.log(JSON.stringify({ sessionsPerDay, workingDays: WORKING_DAYS, files: rows }, null, 2));
    return;
  }

  heading('Instruction cost (input tokens)');
  dim(`Per month = ${sessionsPerDay} sessions/day × ${WORKING_DAYS} working days = ${perMonth} sessions, per developer.`);

  if (!rows.length) {
    console.log();
    warn('No always-on files — enable providers in .cortex/config.yaml.');
    return;
  }
  for (const m of models.filter(m => m.estimated)) {
    warn(`'${m.name}' is not in the registry — priced ${m.basis ? `like ${m.basis}` : 'from family defaults'} (~est.). Run \`cortex update\`.`);
  }

  for (const row of rows) {
    console.log();
    info(`${row.path} — ${row.usedBy.join(', ')}`);
    dim(`${'Model'.padEnd(28)} ${'Tokens'.padStart(7)} ${'$/1M in'.padStart(8)} ${'1K sessions'.padStart(12)} ${'Month'.padStart(9)} ${'Month cached'.padStart(13)}`);
    for (const c of row.models) {
      const name = `${c.model}${c.estimated ? ' ~est.' : ''}`;
      dim(`${name.padEnd(28)} ${formatTokens(c.tokens).padStart(7)} ${formatPrice(c.inputPer1M).padStart(8)} ${formatUSD(c.per1kSessions).padStart(12)} ${formatUSD(c.perMonth).padStart(9)} ${formatUSD(c.perMonthCached).padStart(13)}`);
    }
  }

  console.log();
  dim('Instructions are input tokens; "cached" uses the cache-read price where the provider offers prompt caching.');
  dim('Subscription tools (Cursor, Copilot, Windsurf) bill per seat — this shows what the tokens would cost via the API.');
  console.log();
}
