// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Adaptation Engine — the feedback loop that makes context evolve.
 *
 * The core insight: AI tools are stateless. They don't learn.
 * But WE can learn on their behalf by:
 *
 *   1. Capturing signals (what user did after AI responded)
 *   2. Distilling those into rules (what should change)
 *   3. Evolving the context files (write better instructions)
 *   4. Tracking what works (measure signal quality over time)
 *
 * This creates the illusion of AI that learns, because the INSTRUCTIONS
 * get better every cycle. The model is the same — the prompt improves.
 *
 * ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 * │ Signals │ ──▶ │ Distill  │ ──▶ │ Evolve   │ ──▶ │ Compile  │
 * └─────────┘     └──────────┘     └──────────┘     └──────────┘
 *      ▲                                                  │
 *      └──────────── user works with AI ──────────────────┘
 */

import { join } from 'node:path';
import { existsSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { getCortexDir, readFileSafe, writeFileSafe } from '../utils/fs.js';
import { stringify, parse } from '../utils/yaml.js';

const ADAPTATION_FILE = 'adaptations.yaml';
const HISTORY_DIR = 'history';
const MAX_HISTORY = 20;

/**
 * Process captured signals into adaptation actions.
 *
 * @param {object} signalReport - Output from captureSignals()
 * @param {object} currentConfig - Current cortex config
 * @returns {object} Adaptation plan
 */
export function distillSignals(signalReport) {
  const plan = {
    timestamp: new Date().toISOString(),
    newRules: [],        // Rules to add to .cortex/rules/
    modifiedRules: [],   // Existing rules to update
    removedRules: [],    // Rules to remove (user rejected them)
    contextUpdates: [],  // Updates to config.yaml context section
    profileUpdates: [],  // Updates to user profile
    importedRules: [],   // Rules imported from existing provider files
  };

  for (const signal of signalReport.signals) {
    switch (signal.action) {
      case 'add_to_rules':
        if (signal.confidence >= 0.7) {
          plan.newRules.push({
            content: signal.content,
            source: signal.source,
            provider: signal.provider,
            confidence: signal.confidence,
          });
        }
        break;

      case 'remove_from_rules':
        plan.removedRules.push({
          content: signal.content,
          source: signal.source,
          reason: 'User removed from compiled output',
        });
        break;

      case 'add_to_context':
        plan.contextUpdates.push({
          content: signal.content,
          category: signal.category,
          confidence: signal.confidence,
          source: signal.source,
        });
        break;

      case 'import_as_rule':
        plan.importedRules.push({
          content: signal.content,
          source: signal.source,
          provider: signal.provider,
          confidence: signal.confidence,
        });
        break;

      case 'track_evolution':
        // Record that user is actively editing rules (meta-signal)
        plan.profileUpdates.push({
          key: 'active_refinement',
          value: true,
          meta: signal.meta,
        });
        break;
    }
  }

  // Deduplicate new rules
  const seen = new Set();
  plan.newRules = plan.newRules.filter(r => {
    if (seen.has(r.content)) return false;
    seen.add(r.content);
    return true;
  });

  plan.contextUpdates = plan.contextUpdates.filter(r => {
    if (seen.has(r.content)) return false;
    seen.add(r.content);
    return true;
  });

  return plan;
}

/**
 * Apply an adaptation plan to the .cortex/ directory.
 * This is the "evolution" step — actually changing the source of truth.
 *
 * Every write is a merge: existing bullets, comments and user edits are kept,
 * and only rules not already present are added. Nothing is removed
 * automatically — rules the user deleted from generated output are reported
 * as `suggestedRemovals` with the file:line to edit.
 */
export function applyAdaptation(projectRoot, plan, { dry = false } = {}) {
  const cortexDir = getCortexDir(projectRoot);
  const rulesDir = join(cortexDir, 'rules');
  const results = { applied: [], skipped: [], errors: [], suggestedRemovals: [] };

  const group = (items, keyFn) => {
    const map = new Map();
    for (const item of items) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item.content);
    }
    return [...map].map(([heading, list]) => ({ heading, items: list }));
  };

  const targets = [
    {
      type: 'auto-detected rules',
      file: 'auto-detected.md',
      title: 'Auto-Detected Project Rules',
      intro: 'Generated by `cortex learn` — edit or remove lines as needed.',
      sections: group(plan.contextUpdates || [], u => capitalize(u.category || 'general')),
    },
    {
      type: 'imported rules',
      file: 'imported.md',
      title: 'Imported Rules',
      intro: 'Imported from existing provider config files by `cortex learn`.',
      sections: group(plan.importedRules || [], r => `From ${r.provider || 'unknown'}`),
    },
    {
      type: 'user corrections',
      file: 'corrections.md',
      title: 'User Corrections',
      intro: 'Rules added because you edited compiled output. Highest priority.',
      sections: group(plan.newRules || [], () => null),
    },
  ];

  for (const target of targets) {
    if (!target.sections.length) continue;
    const path = join(rulesDir, target.file);
    try {
      const merged = mergeBullets(readFileSafe(path), target);
      if (!merged.added.length) continue;
      if (!dry) writeFileSafe(path, merged.content, { force: true });
      results.applied.push({ type: target.type, count: merged.added.length, path, items: merged.added });
    } catch (err) {
      results.errors.push({ type: target.type, path, error: err.message });
    }
  }

  for (const removed of plan.removedRules || []) {
    const locations = findRuleLocations(rulesDir, removed.content);
    if (locations.length) results.suggestedRemovals.push({ content: removed.content, source: removed.source, locations });
  }

  if (!dry && results.applied.length > 0) {
    saveHistory(cortexDir, plan, results);
  }

  return results;
}

// ── Bullet merging ─────────────────────────────────────────────────────────

const BULLET_LINE = /^\s*(?:[-*+]|\d+[.)])\s+/;

/** Remove leading list markers, including doubled ones like "- - rule". */
export function stripBullet(text) {
  let out = String(text ?? '').trim();
  let prev;
  do {
    prev = out;
    out = out.replace(/^(?:[-*+]|\d+[.)])\s+/, '').trim();
  } while (out !== prev);
  return out;
}

function normalizeRule(text) {
  return stripBullet(text).replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Merge new bullets into an existing markdown rules file without rewriting it.
 * @param {string|null} existing - current file content (null if missing)
 * @param {{title:string, intro?:string, sections:Array<{heading:string|null, items:string[]}>}} spec
 * @returns {{content:string, added:string[]}}
 */
export function mergeBullets(existing, { title, intro, sections }) {
  const text = existing && existing.trim() ? existing.replace(/\r\n?/g, '\n') : null;
  const lines = text
    ? text.replace(/\n+$/, '').split('\n')
    : [`# ${title}`, ...(intro ? [`<!-- ${intro} -->`] : [])];

  const seen = new Set(lines.filter(l => BULLET_LINE.test(l)).map(normalizeRule));
  const added = [];

  for (const { heading, items } of sections) {
    const fresh = [];
    for (const item of items) {
      const clean = stripBullet(item);
      const key = normalizeRule(clean);
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      fresh.push(clean);
    }
    if (!fresh.length) continue;
    added.push(...fresh);
    const bullets = fresh.map(f => `- ${f}`);

    if (!heading) {
      appendBlock(lines, bullets);
      continue;
    }

    const h = lines.findIndex(l => /^##\s+/.test(l) && l.replace(/^##\s+/, '').trim().toLowerCase() === heading.toLowerCase());
    if (h === -1) {
      appendBlock(lines, [`## ${heading}`, ...bullets]);
      continue;
    }
    let end = lines.length;
    for (let k = h + 1; k < lines.length; k++) {
      if (/^#{1,2}\s/.test(lines[k])) { end = k; break; }
    }
    let insertAt = h + 1;
    for (let k = h + 1; k < end; k++) {
      if (BULLET_LINE.test(lines[k]) || (/^\s{2,}\S/.test(lines[k]) && k === insertAt)) insertAt = k + 1;
    }
    lines.splice(insertAt, 0, ...bullets);
  }

  return { content: lines.join('\n') + '\n', added };
}

function appendBlock(lines, block) {
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const last = lines[lines.length - 1] || '';
  const isBulletRun = BULLET_LINE.test(last) && BULLET_LINE.test(block[0]);
  if (lines.length && !isBulletRun) lines.push('');
  lines.push(...block);
}

/** Find where a rule lives in .cortex/rules/*.md → [{ file, line }]. */
export function findRuleLocations(rulesDir, content) {
  const target = normalizeRule(content);
  const hits = [];
  if (!target || !existsSync(rulesDir)) return hits;
  for (const name of readdirSync(rulesDir).sort()) {
    if (!name.endsWith('.md')) continue;
    const path = join(rulesDir, name);
    const lines = (readFileSafe(path) || '').split('\n');
    lines.forEach((l, i) => {
      if (BULLET_LINE.test(l) && normalizeRule(l) === target) hits.push({ file: path, line: i + 1 });
    });
  }
  return hits;
}

/**
 * Load the adaptation state for a project.
 */
export function loadAdaptationState(projectRoot) {
  const cortexDir = getCortexDir(projectRoot);
  const statePath = join(cortexDir, ADAPTATION_FILE);
  const raw = readFileSafe(statePath);

  if (!raw) {
    return {
      version: 1,
      lastAdapted: null,
      totalCycles: 0,
      signalCounts: {},
    };
  }

  return parse(raw);
}

/**
 * Save adaptation state.
 */
export function saveAdaptationState(projectRoot, state) {
  const cortexDir = getCortexDir(projectRoot);
  const statePath = join(cortexDir, ADAPTATION_FILE);
  writeFileSafe(statePath, `# cortex adaptation state\n${stringify(state)}\n`, { force: true });
}

// ── History ─────────────────────────────────────────────────────────────────

function saveHistory(cortexDir, plan, results) {
  const historyDir = join(cortexDir, HISTORY_DIR);
  mkdirSync(historyDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const entry = {
    timestamp: plan.timestamp,
    newRules: plan.newRules.length,
    contextUpdates: plan.contextUpdates.length,
    importedRules: plan.importedRules.length,
    applied: results.applied.map(({ type, count, path }) => ({ type, count, path })),
  };

  writeFileSync(
    join(historyDir, `${timestamp}.json`),
    JSON.stringify(entry, null, 2) + '\n',
    'utf-8'
  );
  pruneHistory(historyDir);
}

/** Keep only the newest MAX_HISTORY entries (file names sort chronologically). */
function pruneHistory(historyDir) {
  const entries = readdirSync(historyDir).filter(f => f.endsWith('.json')).sort();
  for (const old of entries.slice(0, Math.max(0, entries.length - MAX_HISTORY))) {
    rmSync(join(historyDir, old), { force: true });
  }
}

function capitalize(str) {
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}
