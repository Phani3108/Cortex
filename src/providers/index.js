// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Provider API (kept for programmatic users of `cortex-aictx`).
 * Every provider is now a view over the engine's target table
 * (src/engine/targets.js) — there is no per-provider formatting code left
 * to drift out of sync.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { TARGETS, DETECTION, compile as compileEngine } from '../engine/index.js';

function makeProvider(target) {
  return {
    name: target.name,
    slug: target.id,
    files: [target.mainFile, target.scopedPattern, target.skillsDir && `${target.skillsDir}/<name>/SKILL.md`].filter(Boolean),
    target,
    /**
     * Legacy signature: compile(projectRoot, config, rules, skills) → [{ path, content }]
     * rules: [{ content|text, category }], skills: [{ name, content }]
     */
    compile(projectRoot, config, rules = [], skills = []) {
      const ruleFiles = [{
        path: 'rules.md',
        content: rules.map(r => `## ${r.category || 'rules'}\n- ${r.content || r.text}`).join('\n'),
      }];
      const skillFiles = skills.map(s => ({ path: `${s.name}.md`, content: s.content || s.body || '' }));
      const { outputs } = compileEngine({
        ruleFiles,
        skillFiles,
        config: { ...config, providers: { [target.id]: config?.providers?.[target.id] || true } },
      });
      return outputs.map(o => ({ ...o, path: join(projectRoot, o.path) }));
    },
    detect(projectRoot) {
      return (DETECTION[target.id] || []).some(p => existsSync(join(projectRoot, p)));
    },
  };
}

const providers = Object.fromEntries(Object.values(TARGETS).map(t => [t.id, makeProvider(t)]));

export function getProvider(name) {
  return providers[name] || null;
}

export function getAllProviders() {
  return { ...providers };
}

export function getEnabledProviders(config) {
  const enabled = {};
  for (const [name, provider] of Object.entries(providers)) {
    const v = config.providers?.[name];
    if (v === true || (v && typeof v === 'object' && v.enabled !== false)) enabled[name] = provider;
  }
  return enabled;
}
