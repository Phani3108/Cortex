// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cortex engine — the pure, isomorphic core (no Node built-ins).
 * Imported by the CLI and served verbatim to the website playground.
 */
export { compile, normalizeTargets, isGenerated, renderSkill, skillDirsFor, MARKER, HOMEPAGE } from './compile.js';
export { TARGETS, TARGET_IDS, DEFAULT_TARGETS, DETECTION, IMPORTABLE, LEGACY_OUTPUTS, SHARED_SKILLS_DIR, VERIFIED_ON, resolveTargetId } from './targets.js';
export { parseRuleFile, parseSkillFile, splitFrontmatter, dedupeRules, slugify } from './rules.js';
export { formatRules, styleForFormatFamily, STYLES } from './format.js';
export { fitRules, scoreRule } from './budget.js';
export { estimateTokens, measure, byteLength, formatTokens, tokenizerFor, CHARS_PER_TOKEN } from './tokens.js';
