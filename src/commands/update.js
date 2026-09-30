// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex update — refresh model data and check for a newer Cortex.
 *
 *   cortex update                       registry from GitHub (daily-refreshed), OpenRouter fallback
 *   cortex update --source openrouter   build the registry locally from the live OpenRouter catalog
 */

import { readFileSync } from 'node:fs';
import { syncRegistry, getRegistryInfo } from '../core/registry.js';
import { heading, info, success, dim, warn } from '../utils/log.js';

const PACKAGE = 'cortex-aictx';
const PKG_URL = new URL('../../package.json', import.meta.url);

export default async function update({ values }) {
  const quiet = values.quiet;
  const say = quiet ? () => {} : fn => fn();
  const source = ['github', 'openrouter', 'auto'].includes(values.source) ? values.source : 'auto';

  say(() => heading('Updating Cortex'));

  // 1. Model registry
  const before = getRegistryInfo();
  say(() => dim(`Model data: ${before.modelCount} models, updated ${before.lastUpdated ? before.lastUpdated.slice(0, 10) : 'never'}`));
  const result = await syncRegistry({ source });
  if (!result.success) {
    warn(`Could not refresh model data: ${result.error}`);
    say(() => dim('Using the data bundled with this install. Retry when online.'));
    process.exitCode = 1;
  } else {
    const counts = countChanges(result.changes);
    say(() => {
      success(`Model data refreshed from ${result.source.includes('openrouter') ? 'OpenRouter' : 'the Cortex registry'} — ${result.modelCount.after} models (data as of ${String(result.lastUpdated || '').slice(0, 10)})`);
      if (counts.total) dim(`${counts.added} added · ${counts.price} repriced · ${counts.removed} removed`);
      for (const c of result.changes.filter(c => c.type === 'added').slice(0, 8)) dim(`  + ${c.model}  ($${c.input} in / $${c.output} out per 1M)`);
    });
  }

  // 2. New version? (npm first; the GitHub install path is reported as-is)
  const current = JSON.parse(readFileSync(PKG_URL, 'utf-8')).version;
  const latest = await latestVersion();
  say(() => {
    if (!latest) {
      dim(`Cortex ${current}. Update with: npm install -g github:Phani3108/Cortex`);
    } else if (compareVersions(latest, current) > 0) {
      info(`Cortex ${latest} is available (you have ${current}). Update: npm install -g ${PACKAGE}@latest`);
    } else {
      success(`Cortex ${current} is up to date.`);
    }
  });
}

async function latestVersion() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE}/latest`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = await res.json();
    // Guard against a same-named package that isn't Cortex.
    if (!String(body.repository?.url || '').includes('Phani3108/Cortex')) return null;
    return body.version || null;
  } catch {
    return null;
  }
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function countChanges(changes) {
  return {
    total: changes.length,
    added: changes.filter(c => c.type === 'added').length,
    price: changes.filter(c => c.type === 'price_change').length,
    removed: changes.filter(c => c.type === 'removed').length,
  };
}
