// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex optimize — how your rules fit each tool's size budget.
 *
 * Read-only analysis built on the same engine code `cortex compile` uses
 * (scoreRule + fitRules): for every target with a limit it shows the size vs.
 * the limit and exactly which rules the compiler leaves out, plus the
 * highest- and lowest-value rules overall. It never rewrites your rules.
 *
 *   cortex optimize              every enabled tool
 *   cortex optimize -p windsurf  one tool (enabled or not)
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, info, success, warn, error, dim } from '../utils/log.js';
import { requireCortex, inspectProject, compileTargetAlone } from '../core/health.js';
import { TARGETS, resolveTargetId, scoreRule, measure } from '../engine/index.js';

export default async function optimize({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  let focus = null;
  if (values.provider) {
    focus = resolveTargetId(values.provider);
    if (!focus) {
      error(`Unknown provider '${values.provider}'. Known: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
  }

  let inspection;
  try {
    inspection = inspectProject(projectRoot);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  const ids = focus ? [focus] : Object.keys(inspection.report);
  const analyses = ids.map(id => analyzeTarget(inspection, id));
  const scored = inspection.rules
    .map(r => ({ text: r.text, category: r.label || r.category, priority: r.priority, scope: r.scope, score: scoreRule(r) }))
    .sort((a, b) => b.score - a.score);

  if (values.json) {
    console.log(JSON.stringify({ targets: analyses, rules: scored }, null, 2));
    return;
  }

  heading('Rule budget analysis');
  dim(`${inspection.rules.length} rule(s). Nothing is changed — this shows what \`cortex compile\` does to fit each tool.`);
  if (!ids.length) {
    console.log();
    warn('No providers enabled. Use `-p <tool>` to analyse one anyway.');
  }

  for (const a of analyses) {
    console.log();
    if (a.viaAgentsMd) {
      info(`${a.name}: always-on rules come from AGENTS.md — see the AGENTS.md target.`);
      continue;
    }
    const { unit, soft, hard, size } = a;
    const limit = hard ? `${size.toLocaleString('en-US')} / ${hard.toLocaleString('en-US')} ${unit} (hard limit)`
      : soft ? `${size.toLocaleString('en-US')} / ~${soft.toLocaleString('en-US')} ${unit} (guidance)`
        : `${size.toLocaleString('en-US')} ${unit} (no limit)`;
    const over = (hard && size > hard) || a.dropped.length;
    const line = `${a.name} — ${a.file}: ${limit}${a.enabled ? '' : '  [not enabled]'}`;
    if (over) warn(line);
    else if (soft && size > soft) warn(line);
    else success(line);

    if (a.dropped.length) {
      dim(`${a.kept} of ${a.kept + a.dropped.length} rule(s) kept; left out (lowest value first):`);
      const sorted = [...a.dropped].sort((x, y) => x.score - y.score);
      const shown = focus ? sorted : sorted.slice(0, 10);
      for (const r of shown) {
        dim(`  − [${r.score.toFixed(2)}] ${r.priority === 'critical' ? '(critical!) ' : ''}${r.text.slice(0, 100)}`);
      }
      if (sorted.length > shown.length) dim(`  … and ${sorted.length - shown.length} more (\`cortex optimize -p ${a.id}\` lists all)`);
      if (a.dropped.some(r => r.priority === 'critical')) warn('Critical rules were left out — shorten other rules or move them into scoped files.');
      else dim('To keep them: shorten long rules, move file-specific ones into scoped rule files, or into skills.');
    } else if (hard) {
      dim(`All rules fit — ${(hard - size).toLocaleString('en-US')} ${unit} to spare.`);
    } else if (soft && size > soft) {
      dim(TARGETS[a.id].budget.note);
    }
  }

  if (scored.length > 1) {
    const n = Math.min(5, Math.floor(scored.length / 2));
    console.log();
    info('Highest-value rules (kept first when space is tight):');
    for (const r of scored.slice(0, n)) dim(`[${r.score.toFixed(2)}] ${r.text.slice(0, 100)}`);
    info('Lowest-value rules (dropped first):');
    for (const r of scored.slice(-n).reverse()) dim(`[${r.score.toFixed(2)}] ${r.text.slice(0, 100)}`);
    dim('Score: category weight + priority (`!` = critical) + concrete details (code, paths, numbers); long rules score lower.');
  }
  console.log();
}

function analyzeTarget(inspection, id) {
  const target = TARGETS[id];
  const enabled = !!inspection.report[id];
  const result = enabled ? inspection : compileTargetAlone(inspection, id);
  const entry = result.report[id];
  const main = result.outputs.find(o => o.kind === 'instructions' && (o.targets || [o.target]).includes(id));
  const { unit, soft, hard } = target.budget;
  const base = { id, name: target.name, enabled, unit, soft, hard };
  if (!main) return { ...base, viaAgentsMd: !!entry?.viaAgentsMd, file: null, size: 0, kept: 0, dropped: [] };

  const inlined = result.rules.filter(r => !r.scope || !target.scopedPattern).length;
  const dropped = entry.dropped.map(r => ({ text: r.text, priority: r.priority, score: scoreRule(r) }));
  return {
    ...base,
    viaAgentsMd: false,
    file: main.path,
    size: measure(main.content, unit),
    kept: inlined - dropped.length,
    dropped,
  };
}
