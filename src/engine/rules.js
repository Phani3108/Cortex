// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Source parsing — `.cortex/rules/*.md` and `.cortex/skills/*.md` → items.
 * Pure: takes strings, returns data. Shared by the CLI and the web playground.
 *
 * Rule file format:
 *
 *   ---
 *   scope: ["src/**\/*.tsx"]      # optional: only applies to matching paths
 *   description: React rules      # optional
 *   ---
 *   # Title (ignored)
 *   ## Category                    # becomes the rule category
 *   - Rule text                    # -, *, + or "1." bullets
 *     continuation lines are joined
 *     - nested bullets become part of the parent rule
 *   - ! Critical rule              # leading "!" = must never be dropped
 *   Plain paragraphs under a heading are kept as a single rule.
 */

import { parse as parseYaml } from '../utils/yaml.js';

/** Split optional YAML frontmatter from a markdown document. */
export function splitFrontmatter(text) {
  const src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/);
  if (!m) return { meta: {}, body: src };
  let meta = {};
  try { meta = parseYaml(m[1]) || {}; } catch { meta = {}; }
  return { meta, body: src.slice(m[0].length) };
}

const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'rules';
}

function normalizeScope(scope) {
  if (!scope) return null;
  const list = Array.isArray(scope) ? scope : String(scope).split(',');
  const clean = list.map(s => String(s).trim()).filter(Boolean);
  return clean.length ? clean : null;
}

/**
 * Parse one rules file into rule items.
 * @returns {{ meta: object, rules: Array<{text, category, priority, scope, source}> }}
 */
export function parseRuleFile(content, source = 'rules.md') {
  const { meta, body } = splitFrontmatter(content);
  const scope = normalizeScope(meta.scope || meta.globs || meta.paths || meta.applyTo);
  const filePriority = meta.priority === 'critical' || meta.priority === 'high' ? meta.priority : null;
  const rules = [];
  let label = meta.category ? String(meta.category) : 'General';
  let category = label.toLowerCase();
  let current = null;       // bullet being assembled
  let paragraph = [];
  let inFence = false;

  const push = (text, raw = false) => {
    let t = raw ? text : text.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 3) return;
    let priority = filePriority || 'normal';
    if (/^!\s*/.test(t)) { priority = 'critical'; t = t.replace(/^!\s*/, ''); }
    else if (/^\[(must|critical)\]\s*/i.test(t)) { priority = 'critical'; t = t.replace(/^\[(must|critical)\]\s*/i, ''); }
    rules.push({ text: t, category, label, priority, scope, source });
  };
  const flushBullet = () => { if (current) { push(current.join(' ')); current = null; } };
  const flushParagraph = () => { if (paragraph.length) { push(paragraph.join(' ')); paragraph = []; } };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      // Code fences stay attached to the rule they illustrate
      inFence = !inFence;
      if (current) current.push(trimmed === '```' || trimmed === '~~~' ? '' : '');
      continue;
    }
    if (inFence) continue;

    if (!trimmed) { flushBullet(); flushParagraph(); continue; }
    if (trimmed.startsWith('<!--')) continue;

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushBullet(); flushParagraph();
      if (heading[1].length >= 2) {
        label = heading[2].replace(/[#*`]/g, '').trim() || 'General';
        category = label.toLowerCase();
      }
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const indent = bullet[1].length;
      if (indent >= 2 && current) {
        current.push(`— ${bullet[2]}`);       // nested bullet joins its parent
      } else {
        flushBullet();
        current = [bullet[2]];
      }
      continue;
    }

    if (current && /^\s{2,}/.test(line)) { current.push(trimmed); continue; }
    flushBullet();
    paragraph.push(trimmed);
  }
  flushBullet(); flushParagraph();
  return { meta, rules };
}

/**
 * Parse a skill file. Supports Agent-Skills style frontmatter
 * (name, description) and plain markdown.
 */
export function parseSkillFile(content, fileName = 'skill.md') {
  const { meta, body } = splitFrontmatter(content);
  const base = String(fileName).split('/').pop().replace(/\.(md|txt)$/i, '');
  const name = slugify(meta.name || base);
  const text = body.trim();
  const heading = text.match(/^#\s+(.+)$/m);
  const title = meta.title || (heading ? heading[1].trim() : name);
  let description = meta.description ? String(meta.description).trim() : '';
  if (!description) {
    const para = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .find(p => p && !p.startsWith('#') && !p.startsWith('```') && !/^[-*+]\s/.test(p));
    description = para ? para.replace(/\s+/g, ' ').slice(0, 240) : `${title} skill`;
  }
  return { name, title, description, body: text, scope: normalizeScope(meta.scope || meta.globs), meta };
}

/** Case/punctuation-insensitive de-duplication, keeping the first occurrence. */
export function dedupeRules(rules) {
  const seen = new Map();
  const out = [];
  for (const r of rules) {
    const key = `${(r.scope || []).join('|')}::${r.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const prev = seen.get(key);
    if (prev) {
      if (r.priority === 'critical') prev.priority = 'critical';
      continue;
    }
    const copy = { ...r };
    seen.set(key, copy);
    out.push(copy);
  }
  return out;
}
