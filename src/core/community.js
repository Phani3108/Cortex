// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Community Rules Engine — aggregation + intelligent suggestions.
 *
 * Phase 3 of the intelligence layer:
 *
 * 1. Community Aggregation:
 *    - Fetch shared rule packs from curated sources
 *    - Import rules from public repositories
 *    - Merge community rules with local rules (local always wins)
 *
 * 2. Intelligent Suggestions:
 *    - Analyze project stack → suggest relevant rules
 *    - Detect missing conventions → suggest best practices
 *    - Score suggestion relevance against current rules
 *    - Never auto-apply — always present for user approval
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const COMMUNITY_CACHE_DIR = join(homedir(), '.cortex', 'community');
const COMMUNITY_INDEX_URL = 'https://raw.githubusercontent.com/nicobailon/cortex/main/community/index.json';
const CACHE_STALENESS_HOURS = 24;

// ── Built-in Rule Packs ─────────────────────────────────────────────────────
// These ship with Cortex. Community packs are fetched on demand.

const BUILTIN_PACKS = {
  'typescript-strict': {
    name: 'TypeScript Strict Mode',
    description: 'Best practices for strict TypeScript projects',
    tags: ['typescript', 'strict', 'type-safety'],
    rules: [
      { content: 'Use TypeScript for all new files. Enable strict mode in tsconfig.json.', category: 'language' },
      { content: 'Never use `any` type. Use `unknown` for truly unknown types, then narrow with type guards.', category: 'language' },
      { content: 'Prefer `interface` over `type` for object shapes that may be extended.', category: 'language' },
      { content: 'Use `const` assertions for literal types. Prefer `as const` over manual type annotations.', category: 'language' },
      { content: 'Add return types to all exported functions. Inferred types are fine for internal helpers.', category: 'language' },
    ],
  },
  'react-modern': {
    name: 'Modern React Patterns',
    description: 'React 19+ patterns with hooks and server components',
    tags: ['react', 'hooks', 'server-components', 'frontend'],
    rules: [
      { content: 'Use functional components with hooks. Never use class components.', category: 'framework' },
      { content: 'Prefer Server Components by default. Add "use client" only when needed for interactivity.', category: 'framework' },
      { content: 'Use `useActionState` for form handling instead of manual state management.', category: 'framework' },
      { content: 'Extract reusable logic into custom hooks (use* prefix). Keep components focused on rendering.', category: 'framework' },
      { content: 'Use Suspense boundaries for loading states. Avoid manual isLoading state variables.', category: 'framework' },
    ],
  },
  'python-modern': {
    name: 'Modern Python',
    description: 'Python 3.12+ best practices',
    tags: ['python', 'typing', 'modern'],
    rules: [
      { content: 'Use type hints on all function signatures. Use `from __future__ import annotations` for forward references.', category: 'language' },
      { content: 'Use `pathlib.Path` instead of `os.path` for file operations.', category: 'language' },
      { content: 'Use dataclasses or Pydantic models instead of plain dicts for structured data.', category: 'language' },
      { content: 'Use `match` statements (structural pattern matching) for complex conditionals.', category: 'language' },
      { content: 'Prefer `asyncio` for I/O-bound operations. Use `async def` and `await` consistently.', category: 'language' },
    ],
  },
  'security-basics': {
    name: 'Security Fundamentals',
    description: 'OWASP-aligned security rules for any project',
    tags: ['security', 'owasp', 'universal'],
    rules: [
      { content: 'Never hardcode secrets, API keys, or credentials. Use environment variables or secret managers.', category: 'security' },
      { content: 'Always validate and sanitize user input. Never trust data from external sources.', category: 'security' },
      { content: 'Use parameterized queries for all database operations. Never concatenate user input into SQL.', category: 'security' },
      { content: 'Implement proper error handling that does not leak internal details to users.', category: 'security' },
      { content: 'Use HTTPS for all external communications. Validate TLS certificates.', category: 'security' },
      { content: 'Apply the principle of least privilege for all access controls and permissions.', category: 'security' },
    ],
  },
  'testing-tdd': {
    name: 'Test-Driven Development',
    description: 'TDD workflow and testing best practices',
    tags: ['testing', 'tdd', 'quality'],
    rules: [
      { content: 'Write tests before implementation code. Follow Red-Green-Refactor cycle.', category: 'testing' },
      { content: 'Each test should test one behavior. Use descriptive test names that read like specifications.', category: 'testing' },
      { content: 'Use the Arrange-Act-Assert pattern in test structure.', category: 'testing' },
      { content: 'Mock external dependencies (APIs, databases, file system) in unit tests.', category: 'testing' },
      { content: 'Aim for meaningful coverage, not 100%. Test edge cases, error paths, and boundaries.', category: 'testing' },
    ],
  },
  'api-rest': {
    name: 'REST API Design',
    description: 'RESTful API design conventions',
    tags: ['api', 'rest', 'backend'],
    rules: [
      { content: 'Use plural nouns for resource endpoints (e.g., /users, /orders). Never use verbs in URLs.', category: 'conventions' },
      { content: 'Return appropriate HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error.', category: 'conventions' },
      { content: 'Use JSON for request/response bodies. Set Content-Type: application/json header.', category: 'conventions' },
      { content: 'Implement pagination for list endpoints. Use cursor-based pagination for large datasets.', category: 'conventions' },
      { content: 'Version your API (e.g., /v1/users). Never break existing endpoints — add new versions instead.', category: 'conventions' },
    ],
  },
  'git-workflow': {
    name: 'Git Workflow',
    description: 'Conventional commits and branch management',
    tags: ['git', 'conventions', 'workflow'],
    rules: [
      { content: 'Use conventional commits: feat:, fix:, chore:, docs:, style:, refactor:, test:, perf:', category: 'conventions' },
      { content: 'Keep commits atomic — one logical change per commit. Avoid mixing unrelated changes.', category: 'conventions' },
      { content: 'Write descriptive commit messages: imperative mood, max 72 chars for subject line.', category: 'conventions' },
      { content: 'Create feature branches from main. Use short-lived branches — merge within a few days.', category: 'conventions' },
    ],
  },
};

// ── Pack Discovery ──────────────────────────────────────────────────────────

/**
 * List all available rule packs (builtin + cached community).
 */
export function listPacks() {
  const packs = [];

  // Built-in packs
  for (const [id, pack] of Object.entries(BUILTIN_PACKS)) {
    packs.push({
      id,
      name: pack.name,
      description: pack.description,
      tags: pack.tags,
      ruleCount: pack.rules.length,
      source: 'builtin',
    });
  }

  // Cached community packs
  const communityIndex = loadCommunityIndex();
  if (communityIndex) {
    for (const pack of communityIndex.packs || []) {
      packs.push({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        tags: pack.tags || [],
        ruleCount: pack.ruleCount || 0,
        source: 'community',
        author: pack.author,
      });
    }
  }

  return packs;
}

/**
 * Get a specific rule pack by ID.
 */
export function getPack(packId) {
  // Check built-in first
  if (BUILTIN_PACKS[packId]) {
    return { ...BUILTIN_PACKS[packId], id: packId, source: 'builtin' };
  }

  // Check community cache
  const cachePath = join(COMMUNITY_CACHE_DIR, 'packs', `${packId}.json`);
  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, 'utf-8'));
    } catch {}
  }

  return null;
}

// ── Intelligent Suggestions ─────────────────────────────────────────────────

/**
 * Analyze a project and suggest relevant rule packs/rules.
 *
 * @param {string} projectRoot  - Project root
 * @param {Array}  currentRules - Currently active rules
 * @param {object} config       - Current cortex config
 * @returns {Array<{pack, relevance, reason, newRules}>} Ranked suggestions
 */
export function suggestRules(projectRoot, currentRules = [], config = {}) {
  const projectSignals = detectProjectStack(projectRoot, config);
  const currentContent = new Set(currentRules.map(r => normalizeRule(r.content)));
  const suggestions = [];

  for (const [packId, pack] of Object.entries(BUILTIN_PACKS)) {
    const relevance = calculateRelevance(pack, projectSignals);
    if (relevance < 0.3) continue;

    // Filter out rules the user already has
    const newRules = pack.rules.filter(r => !currentContent.has(normalizeRule(r.content)));
    if (newRules.length === 0) continue;

    suggestions.push({
      pack: { id: packId, name: pack.name, description: pack.description },
      relevance: +relevance.toFixed(2),
      reason: explainRelevance(pack, projectSignals),
      newRules,
      existingRuleOverlap: pack.rules.length - newRules.length,
    });
  }

  // Sort by relevance
  suggestions.sort((a, b) => b.relevance - a.relevance);

  return suggestions;
}

/**
 * Suggest individual rules based on detected gaps.
 */
export function suggestMissingRules(projectRoot, currentRules = [], config = {}) {
  const signals = detectProjectStack(projectRoot, config);
  const currentContent = new Set(currentRules.map(r => normalizeRule(r.content)));
  const missing = [];

  // Check for common gaps
  if (signals.hasTests && !currentRules.some(r => /test/i.test(r.content))) {
    missing.push({
      content: 'Always include tests with new features. Follow existing test patterns in the project.',
      category: 'testing',
      reason: 'Project has tests but no testing rules defined',
      confidence: 0.8,
    });
  }

  if (signals.hasLinter && !currentRules.some(r => /lint|eslint|ruff/i.test(r.content))) {
    missing.push({
      content: `Follow the ${signals.linterName} configuration. Run linting before committing.`,
      category: 'linting',
      reason: `${signals.linterName} detected but no linting rules defined`,
      confidence: 0.9,
    });
  }

  if (signals.hasTypeScript && !currentRules.some(r => /type|typescript/i.test(r.content))) {
    missing.push({
      content: 'Use TypeScript for all new files. Add type annotations to function signatures.',
      category: 'language',
      reason: 'TypeScript project but no type-related rules',
      confidence: 0.85,
    });
  }

  if (!currentRules.some(r => /security|secret|credential|sanitiz/i.test(r.content))) {
    missing.push({
      content: 'Never hardcode secrets or API keys. Validate all user input.',
      category: 'security',
      reason: 'No security rules defined — every project needs basic security hygiene',
      confidence: 0.7,
    });
  }

  if (signals.hasGit && signals.hasConventionalCommits && !currentRules.some(r => /commit|conventional/i.test(r.content))) {
    missing.push({
      content: 'Use conventional commits: feat:, fix:, chore:, docs:, refactor:, test:',
      category: 'conventions',
      reason: 'Project uses conventional commits but no commit convention rule defined',
      confidence: 0.75,
    });
  }

  // Filter out rules that already exist
  return missing.filter(r => !currentContent.has(normalizeRule(r.content)));
}

// ── Community Sync ──────────────────────────────────────────────────────────

/**
 * Sync community rule packs from remote source.
 */
export async function syncCommunityPacks(url = COMMUNITY_INDEX_URL) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'cortex-cli' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Validate structure
    if (!data.packs || !Array.isArray(data.packs)) {
      return { success: false, error: 'Invalid community index format' };
    }

    // Save index
    const indexPath = join(COMMUNITY_CACHE_DIR, 'index.json');
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, JSON.stringify({ ...data, syncedAt: new Date().toISOString() }, null, 2));

    return {
      success: true,
      packsAvailable: data.packs.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Project Stack Detection ─────────────────────────────────────────────────

function detectProjectStack(projectRoot, config) {
  const signals = {
    languages: [],
    frameworks: [],
    hasTests: false,
    hasLinter: false,
    linterName: '',
    hasTypeScript: false,
    hasPython: false,
    hasGit: false,
    hasConventionalCommits: false,
    hasDocker: false,
    hasCI: false,
  };

  // From config
  if (config.project?.language) signals.languages.push(config.project.language);
  if (config.project?.framework) signals.frameworks.push(config.project.framework);

  // File detection
  const checks = [
    { file: 'tsconfig.json', action: () => { signals.hasTypeScript = true; signals.languages.push('typescript'); } },
    { file: 'pyproject.toml', action: () => { signals.hasPython = true; signals.languages.push('python'); } },
    { file: 'Cargo.toml', action: () => signals.languages.push('rust') },
    { file: 'go.mod', action: () => signals.languages.push('go') },
    { file: '.git', action: () => { signals.hasGit = true; } },
    { file: 'Dockerfile', action: () => { signals.hasDocker = true; } },
    { file: '.github/workflows', action: () => { signals.hasCI = true; } },
  ];

  for (const check of checks) {
    if (existsSync(join(projectRoot, check.file))) check.action();
  }

  // Package.json analysis
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.react) signals.frameworks.push('react');
      if (deps.next) signals.frameworks.push('nextjs');
      if (deps.vue) signals.frameworks.push('vue');
      if (deps.svelte) signals.frameworks.push('svelte');
      if (deps.express) signals.frameworks.push('express');
      if (deps.fastify) signals.frameworks.push('fastify');

      if (deps.vitest || deps.jest || deps.mocha) signals.hasTests = true;
      if (deps.eslint) { signals.hasLinter = true; signals.linterName = 'ESLint'; }
    } catch {}
  }

  // Python linter
  if (existsSync(join(projectRoot, 'pyproject.toml'))) {
    try {
      const content = readFileSync(join(projectRoot, 'pyproject.toml'), 'utf-8');
      if (content.includes('ruff')) { signals.hasLinter = true; signals.linterName = 'Ruff'; }
      if (content.includes('pytest')) signals.hasTests = true;
    } catch {}
  }

  return signals;
}

// ── Relevance Scoring ───────────────────────────────────────────────────────

function calculateRelevance(pack, signals) {
  let score = 0;
  const tags = pack.tags || [];

  // Language match
  for (const lang of signals.languages) {
    if (tags.some(t => t.toLowerCase().includes(lang.toLowerCase()))) score += 0.4;
  }

  // Framework match
  for (const fw of signals.frameworks) {
    if (tags.some(t => t.toLowerCase().includes(fw.toLowerCase()))) score += 0.4;
  }

  // Category match
  if (tags.includes('testing') && signals.hasTests) score += 0.3;
  if (tags.includes('security')) score += 0.2; // Always somewhat relevant
  if (tags.includes('git') && signals.hasGit) score += 0.2;
  if (tags.includes('universal')) score += 0.15;

  return Math.min(1.0, score);
}

function explainRelevance(pack, signals) {
  const reasons = [];
  const tags = pack.tags || [];

  for (const lang of signals.languages) {
    if (tags.some(t => t.toLowerCase().includes(lang.toLowerCase()))) {
      reasons.push(`Project uses ${lang}`);
    }
  }

  for (const fw of signals.frameworks) {
    if (tags.some(t => t.toLowerCase().includes(fw.toLowerCase()))) {
      reasons.push(`Project uses ${fw}`);
    }
  }

  if (tags.includes('security')) reasons.push('Security best practices');
  if (tags.includes('testing') && signals.hasTests) reasons.push('Project has tests');

  return reasons.length > 0 ? reasons.join(', ') : 'General best practice';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeRule(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function loadCommunityIndex() {
  const indexPath = join(COMMUNITY_CACHE_DIR, 'index.json');
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
}

export { BUILTIN_PACKS };
