// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Provider Health Assessment — surfaces the state of each AI tool.
 *
 * Reports on:
 * - Registry freshness (how stale is model data)
 * - Compiled file integrity (do outputs still exist, are they current)
 * - Provider feature utilization (using MCP? hooks? automations?)
 * - Model availability changes (new models available for your provider)
 * - Configuration gaps (features enabled but not configured)
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROVIDER_SPECS } from './specs.js';
import { isRegistryStale, getRegistryStaleness, getProviderModels } from './registry.js';
import { loadManifest } from './manifest.js';
import { getCortexDir } from '../utils/fs.js';

/**
 * Assess the health of all configured providers for a project.
 *
 * @param {string} projectRoot - Project root
 * @param {object} config      - Loaded config
 * @returns {object} Health report
 */
export function assessHealth(projectRoot, config) {
  const enabledProviders = Object.entries(config.providers || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  const registry = assessRegistryHealth();
  const providers = {};

  for (const slug of enabledProviders) {
    providers[slug] = assessProviderHealth(projectRoot, slug, config);
  }

  const overallScore = calculateOverallScore(registry, providers);

  return {
    overall: {
      score: overallScore,
      label: scoreLabel(overallScore),
    },
    registry,
    providers,
    recommendations: generateHealthRecommendations(registry, providers, enabledProviders),
  };
}

// ── Registry Health ─────────────────────────────────────────────────────────

function assessRegistryHealth() {
  const staleness = getRegistryStaleness();
  const stale = isRegistryStale();

  let status = 'healthy';
  if (staleness === Infinity) status = 'missing';
  else if (staleness > 30) status = 'critical';
  else if (stale) status = 'stale';

  return {
    status,
    staleDays: staleness === Infinity ? null : staleness,
    message: registryMessage(status, staleness),
  };
}

function registryMessage(status, staleness) {
  switch (status) {
    case 'missing':  return 'Registry never synced. Run `cortex update` to fetch latest model data.';
    case 'critical': return `Registry is ${staleness} days old. Model pricing may be inaccurate. Run \`cortex update\`.`;
    case 'stale':    return `Registry is ${staleness} days old. Consider running \`cortex update\`.`;
    default:         return `Registry is current (${staleness} day${staleness !== 1 ? 's' : ''} old).`;
  }
}

// ── Per-Provider Health ─────────────────────────────────────────────────────

function assessProviderHealth(projectRoot, slug, config) {
  const spec = PROVIDER_SPECS[slug];
  if (!spec) return { status: 'unknown', message: `Unknown provider: ${slug}` };

  const issues = [];
  const info = [];

  // 1. Check compiled files exist
  const compiledFiles = checkCompiledFiles(projectRoot, spec);
  if (compiledFiles.missing.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Missing compiled files: ${compiledFiles.missing.join(', ')}`,
      action: `Run \`cortex compile -p ${slug}\``,
    });
  }

  // 2. Check file staleness (compare to manifest)
  const manifest = loadManifest(projectRoot);
  if (manifest) {
    const staleFiles = checkFileStaleness(manifest, spec, slug);
    if (staleFiles.length > 0) {
      issues.push({
        severity: 'info',
        message: `${staleFiles.length} file(s) modified since last compile`,
        action: 'User edits detected — run `cortex learn` to capture changes, then `cortex compile`',
      });
    }
  } else {
    issues.push({
      severity: 'info',
      message: 'No compile manifest found',
      action: 'Run `cortex compile` to generate provider files',
    });
  }

  // 3. Check for new models available
  const registryModels = getProviderModels(slug);
  const specModels = spec.models || [];
  const newModels = registryModels.filter(m => !specModels.includes(m));
  if (newModels.length > 0) {
    info.push({
      message: `New models available: ${newModels.join(', ')}`,
    });
  }

  // 4. Feature utilization
  const featureReport = checkFeatureUtilization(projectRoot, spec, slug, config);
  if (featureReport.unused.length > 0) {
    info.push({
      message: `Unused features: ${featureReport.unused.join(', ')}`,
    });
  }

  // 5. Determine overall status
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  let status = 'healthy';
  if (criticalCount > 0) status = 'critical';
  else if (warningCount > 0) status = 'warning';
  else if (compiledFiles.existing.length === 0) status = 'not_compiled';

  return {
    name: spec.name,
    status,
    compiledFiles: compiledFiles.existing,
    missingFiles: compiledFiles.missing,
    models: registryModels.length > 0 ? registryModels : specModels,
    newModels,
    features: featureReport,
    issues,
    info,
  };
}

// ── Compiled File Checks ────────────────────────────────────────────────────

function checkCompiledFiles(projectRoot, spec) {
  const existing = [];
  const missing = [];

  for (const cf of spec.contextFiles || []) {
    if (!cf.alwaysLoaded) continue;
    if (cf.path.includes('{') || cf.path.includes('*')) continue;
    if (cf.location !== 'project_root') continue;

    const fullPath = join(projectRoot, cf.path);
    if (existsSync(fullPath)) {
      existing.push(cf.path);
    } else {
      missing.push(cf.path);
    }
  }

  return { existing, missing };
}

function checkFileStaleness(manifest, spec, slug) {
  const stale = [];
  for (const entry of manifest.files || []) {
    if (entry.provider !== slug) continue;
    if (!existsSync(entry.path)) continue;

    const current = readFileSync(entry.path, 'utf-8');
    if (current !== entry.compiledContent) {
      stale.push(entry.path);
    }
  }
  return stale;
}

// ── Feature Utilization ─────────────────────────────────────────────────────

function checkFeatureUtilization(projectRoot, spec, slug, config) {
  const used = [];
  const unused = [];
  const features = spec.features || {};

  // Check MCP servers
  if (features.mcpServers) {
    const mcpConfigPaths = [
      join(projectRoot, '.claude', 'mcp.json'),
      join(projectRoot, '.cursor', 'mcp.json'),
      join(projectRoot, '.vscode', 'mcp.json'),
    ];
    const hasMcp = mcpConfigPaths.some(p => existsSync(p));
    (hasMcp ? used : unused).push('mcpServers');
  }

  // Check custom commands/skills
  if (features.customSlashCommands) {
    const cmdPaths = [
      join(projectRoot, '.claude', 'commands'),
      join(projectRoot, '.gemini', 'commands'),
    ];
    const hasCmds = cmdPaths.some(p => existsSync(p));
    (hasCmds ? used : unused).push('customSlashCommands');
  }

  // Check hooks
  if (features.hooks) {
    const cortexDir = getCortexDir(projectRoot);
    const hasHooks = existsSync(join(cortexDir, 'hooks'));
    (hasHooks ? used : unused).push('hooks');
  }

  // Check memory
  if (features.memory) {
    used.push('memory'); // Memory is auto-used by the provider
  }

  return { used, unused };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function calculateOverallScore(registry, providers) {
  let score = 100;

  // Registry penalties
  if (registry.status === 'missing') score -= 20;
  else if (registry.status === 'critical') score -= 15;
  else if (registry.status === 'stale') score -= 5;

  // Provider penalties
  const providerEntries = Object.values(providers);
  if (providerEntries.length === 0) score -= 30;

  for (const p of providerEntries) {
    if (p.status === 'critical') score -= 15;
    else if (p.status === 'warning') score -= 5;
    else if (p.status === 'not_compiled') score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreLabel(score) {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'needs_attention';
}

// ── Recommendations ─────────────────────────────────────────────────────────

function generateHealthRecommendations(registry, providers, enabledProviders) {
  const recs = [];

  if (registry.status !== 'healthy') {
    recs.push({
      priority: registry.status === 'critical' ? 'high' : 'medium',
      message: registry.message,
    });
  }

  const notCompiled = Object.entries(providers)
    .filter(([, p]) => p.status === 'not_compiled')
    .map(([k]) => k);
  if (notCompiled.length > 0) {
    recs.push({
      priority: 'high',
      message: `Run \`cortex compile\` to generate files for: ${notCompiled.join(', ')}`,
    });
  }

  // Check for providers that could be enabled
  const allProviders = Object.keys(PROVIDER_SPECS);
  const disabled = allProviders.filter(p => !enabledProviders.includes(p));
  if (disabled.length > 0 && enabledProviders.length <= 2) {
    recs.push({
      priority: 'low',
      message: `${disabled.length} additional provider(s) available: ${disabled.slice(0, 3).join(', ')}${disabled.length > 3 ? '...' : ''}`,
    });
  }

  return recs;
}
