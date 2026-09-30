// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Minimal YAML parser/serializer — handles the subset cortex needs.
 * Supports: scalars, block and flow sequences/maps (nested), lists of objects,
 * zero-indented lists under a key, comments, quoted strings with escapes,
 * block scalars (|, >, with - / + chomping indicators).
 * No external dependencies.
 */

// ── Parser ──────────────────────────────────────────────────────────────────

export function parse(text) {
  const lines = String(text ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => (l.trim() === '---' || l.trim() === '...' ? '' : l));

  const ctx = { lines, i: 0 };
  const first = nextContent(ctx);
  if (first === -1) return {};

  const firstText = lines[first].trim();
  if (firstText.startsWith('[') || firstText.startsWith('{')) {
    const flow = tryParseFlow(firstText);
    if (flow.ok) return flow.value;
  }

  const value = parseNode(ctx, 0);
  return value === null ? {} : value;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function isContent(line) {
  const t = line.trim();
  return t !== '' && !t.startsWith('#');
}

/** Index of the next non-blank, non-comment line (advancing ctx.i), or -1. */
function nextContent(ctx) {
  while (ctx.i < ctx.lines.length && !isContent(ctx.lines[ctx.i])) ctx.i++;
  return ctx.i < ctx.lines.length ? ctx.i : -1;
}

function isSeqItem(trimmed) {
  return trimmed === '-' || trimmed.startsWith('- ');
}

/** Parse the block starting at the next content line if its indent >= minIndent. */
function parseNode(ctx, minIndent) {
  const idx = nextContent(ctx);
  if (idx === -1) return null;
  const line = ctx.lines[idx];
  const indent = indentOf(line);
  if (indent < minIndent) return null;
  return isSeqItem(line.trim()) ? parseSeq(ctx, indent) : parseMap(ctx, indent);
}

function parseSeq(ctx, indent) {
  const arr = [];

  while (true) {
    const idx = nextContent(ctx);
    if (idx === -1) break;
    const line = ctx.lines[idx];
    const trimmed = line.trim();
    if (indentOf(line) !== indent || !isSeqItem(trimmed)) break;

    const content = trimmed.slice(1).trimStart();
    if (content === '' || content.startsWith('#')) {
      ctx.i++;
      arr.push(parseNode(ctx, indent + 1));
      continue;
    }

    if (!/^[[{]/.test(content) && findKeyColonIndex(stripInlineComment(content)) > 0) {
      // "- key: value" — rewrite the dash as spaces and parse a map at that column
      const column = indent + (trimmed.length - content.length);
      ctx.lines[idx] = ' '.repeat(column) + content;
      arr.push(parseMap(ctx, column));
      continue;
    }

    if (isSeqItem(content)) {
      // "- - a" nested sequence on one line
      const column = indent + (trimmed.length - content.length);
      ctx.lines[idx] = ' '.repeat(column) + content;
      arr.push(parseSeq(ctx, column));
      continue;
    }

    ctx.i++;
    arr.push(parseValue(content));
  }

  return arr;
}

function parseMap(ctx, indent) {
  const obj = {};

  while (true) {
    const idx = nextContent(ctx);
    if (idx === -1) break;
    const line = ctx.lines[idx];
    const lineIndent = indentOf(line);
    const trimmed = line.trim();
    if (lineIndent < indent || isSeqItem(trimmed)) break;

    const colonIdx = findKeyColonIndex(trimmed);
    ctx.i++;
    if (colonIdx === -1) continue; // not a key — ignore leniently

    const key = unquoteKey(trimmed.slice(0, colonIdx).trim());
    const after = stripInlineComment(trimmed.slice(colonIdx + 1)).trim();

    if (/^[|>][-+]?\d*$/.test(after)) {
      obj[key] = parseBlockScalar(ctx, lineIndent, after);
    } else if (after === '') {
      const nextIdx = nextContent(ctx);
      if (nextIdx === -1) { obj[key] = null; continue; }
      const next = ctx.lines[nextIdx];
      const nextIndent = indentOf(next);
      if (nextIndent > lineIndent) {
        obj[key] = parseNode(ctx, nextIndent);
      } else if (nextIndent === lineIndent && isSeqItem(next.trim())) {
        obj[key] = parseSeq(ctx, lineIndent); // zero-indented list under a key
      } else {
        obj[key] = null;
      }
    } else {
      obj[key] = parseValue(after);
    }
  }

  return obj;
}

function parseBlockScalar(ctx, parentIndent, header) {
  const style = header[0];
  const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip';
  const parts = [];
  let base = -1;

  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (!line.trim()) { parts.push(''); ctx.i++; continue; }
    const lineIndent = indentOf(line);
    if (lineIndent <= parentIndent) break;
    if (base === -1) base = lineIndent;
    parts.push(lineIndent >= base ? line.slice(base) : line.trimStart());
    ctx.i++;
  }

  let trailing = 0;
  while (parts.length && parts[parts.length - 1] === '') { parts.pop(); trailing++; }

  let body;
  if (style === '|') {
    body = parts.join('\n');
  } else {
    // Folded: single newlines become spaces, blank lines become newlines
    body = '';
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (k === 0) body = p;
      else if (p === '') body += '\n';
      else body += (parts[k - 1] === '' ? '' : ' ') + p;
    }
  }

  if (chomp === 'strip' || !body) return body;
  if (chomp === 'keep') return body + '\n'.repeat(trailing + 1);
  return style === '|' ? body + '\n' : body;
}

function parseValue(str) {
  const clean = stripInlineComment(str).trim();
  if (clean.startsWith('[') || clean.startsWith('{')) {
    const flow = tryParseFlow(clean);
    if (flow.ok) return flow.value;
  }
  return parseScalar(clean);
}

// ── Flow collections: [a, "b", {c: d}] ──────────────────────────────────────

function tryParseFlow(str) {
  try {
    const state = { s: str, p: 0 };
    const value = parseFlowValue(state);
    skipWs(state);
    if (state.p !== state.s.length && !state.s.slice(state.p).trim().startsWith('#')) {
      return { ok: false };
    }
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function skipWs(st) {
  while (st.p < st.s.length && /\s/.test(st.s[st.p])) st.p++;
}

function parseFlowValue(st) {
  skipWs(st);
  const ch = st.s[st.p];
  if (ch === '[') return parseFlowSeq(st);
  if (ch === '{') return parseFlowMap(st);
  if (ch === '"' || ch === "'") return readQuoted(st);
  return parseScalar(readPlain(st, ',]}'));
}

function parseFlowSeq(st) {
  st.p++; // [
  const arr = [];
  skipWs(st);
  if (st.s[st.p] === ']') { st.p++; return arr; }
  while (st.p < st.s.length) {
    arr.push(parseFlowValue(st));
    skipWs(st);
    const ch = st.s[st.p++];
    if (ch === ']') return arr;
    if (ch !== ',') throw new Error('bad flow sequence');
    skipWs(st);
    if (st.s[st.p] === ']') { st.p++; return arr; } // trailing comma
  }
  throw new Error('unterminated flow sequence');
}

function parseFlowMap(st) {
  st.p++; // {
  const obj = {};
  skipWs(st);
  if (st.s[st.p] === '}') { st.p++; return obj; }
  while (st.p < st.s.length) {
    skipWs(st);
    const ch = st.s[st.p];
    const key = ch === '"' || ch === "'" ? readQuoted(st) : readPlain(st, ':,}');
    skipWs(st);
    if (st.s[st.p] !== ':') throw new Error('bad flow map');
    st.p++;
    skipWs(st);
    obj[String(key)] = st.s[st.p] === ',' || st.s[st.p] === '}' ? null : parseFlowValue(st);
    skipWs(st);
    const end = st.s[st.p++];
    if (end === '}') return obj;
    if (end !== ',') throw new Error('bad flow map');
    skipWs(st);
    if (st.s[st.p] === '}') { st.p++; return obj; }
  }
  throw new Error('unterminated flow map');
}

function readPlain(st, stops) {
  const start = st.p;
  while (st.p < st.s.length && !stops.includes(st.s[st.p])) st.p++;
  return st.s.slice(start, st.p).trim();
}

function readQuoted(st) {
  const q = st.s[st.p];
  let end = st.p + 1;
  while (end < st.s.length) {
    if (q === '"' && st.s[end] === '\\') { end += 2; continue; }
    if (st.s[end] === q) {
      if (q === "'" && st.s[end + 1] === "'") { end += 2; continue; }
      break;
    }
    end++;
  }
  if (end >= st.s.length) throw new Error('unterminated string');
  const raw = st.s.slice(st.p, end + 1);
  st.p = end + 1;
  return parseScalar(raw);
}

// ── Scalars ─────────────────────────────────────────────────────────────────

function parseScalar(str) {
  str = stripInlineComment(str).trim();

  if (str === '' || str === 'null' || str === '~' || str === 'Null' || str === 'NULL') return null;
  if (str === 'true' || str === 'True' || str === 'TRUE') return true;
  if (str === 'false' || str === 'False' || str === 'FALSE') return false;
  if (/^-?\d+$/.test(str)) {
    const n = parseInt(str, 10);
    return Number.isSafeInteger(n) ? n : str;
  }
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);

  if (str.length >= 2 && str.startsWith('"') && str.endsWith('"')) {
    return unescapeDouble(str.slice(1, -1));
  }
  if (str.length >= 2 && str.startsWith("'") && str.endsWith("'")) {
    return str.slice(1, -1).replace(/''/g, "'");
  }

  return str;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', e: '\x1b', ' ': ' ' };

function unescapeDouble(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, e) => {
    if (e[0] === 'u' || (e[0] === 'x' && e.length === 3)) return String.fromCharCode(parseInt(e.slice(1), 16));
    return e in ESCAPES ? ESCAPES[e] : m;
  });
}

function unquoteKey(key) {
  if (key.length >= 2 && (key.startsWith('"') || key.startsWith("'")) && key.endsWith(key[0])) {
    return String(parseScalar(key));
  }
  return key;
}

/**
 * Find the colon that separates key from value, ignoring colons inside
 * quoted strings and URLs (a key colon must be followed by space or EOL).
 */
function findKeyColonIndex(str) {
  let inQuote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === '\\' && inQuote === '"') { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if ((ch === '"' || ch === "'") && i === 0) { inQuote = ch; continue; }
    if (ch === ':' && (i + 1 >= str.length || str[i + 1] === ' ' || str[i + 1] === '\t')) {
      return i;
    }
  }
  return -1;
}

/**
 * Strip trailing inline comments from a value string.
 * e.g. `some value # this is a comment` → `some value`
 * Respects quoted strings — won't strip # inside quotes.
 */
function stripInlineComment(str) {
  let inQuote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === '\\' && inQuote === '"') { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      // Only treat as a quote when it opens a token
      if (i === 0 || /[\s[{,:]/.test(str[i - 1])) inQuote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || str[i - 1] === ' ' || str[i - 1] === '\t')) {
      return str.slice(0, i).trimEnd();
    }
  }
  return str;
}

// ── Serializer ──────────────────────────────────────────────────────────────

/**
 * Serialize a value to YAML. Objects produce `key: value` lines; the result has
 * no trailing newline. `indent` is the column for top-level keys.
 */
export function stringify(obj, indent = 0) {
  if (Array.isArray(obj)) {
    return obj.length ? serializeSeq(obj, indent).join('\n') : ' '.repeat(indent) + '[]';
  }
  if (obj === null || typeof obj !== 'object') {
    return ' '.repeat(indent) + serializeScalar(obj);
  }
  const lines = serializeMap(obj, indent);
  return lines.length ? lines.join('\n') : ' '.repeat(indent) + '{}';
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function serializeMap(obj, indent) {
  const prefix = ' '.repeat(indent);
  const lines = [];
  for (const [rawKey, val] of Object.entries(obj)) {
    if (val === undefined || typeof val === 'function') continue;
    const key = serializeKey(rawKey);
    if (Array.isArray(val)) {
      if (!val.length) lines.push(`${prefix}${key}: []`);
      else lines.push(`${prefix}${key}:`, ...serializeSeq(val, indent + 2));
    } else if (isPlainObject(val)) {
      if (!Object.keys(val).length) lines.push(`${prefix}${key}: {}`);
      else lines.push(`${prefix}${key}:`, ...serializeMap(val, indent + 2));
    } else if (val === null) {
      lines.push(`${prefix}${key}:`);
    } else if (typeof val === 'string' && canUseBlockLiteral(val)) {
      lines.push(`${prefix}${key}: |-`);
      for (const l of val.split('\n')) lines.push(l ? `${prefix}  ${l}` : '');
    } else {
      lines.push(`${prefix}${key}: ${serializeScalar(val)}`);
    }
  }
  return lines;
}

function serializeSeq(arr, indent) {
  const prefix = ' '.repeat(indent);
  const lines = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      if (!item.length) lines.push(`${prefix}- []`);
      else lines.push(`${prefix}-`, ...serializeSeq(item, indent + 2));
    } else if (isPlainObject(item)) {
      const inner = serializeMap(item, indent + 2);
      if (!inner.length) { lines.push(`${prefix}- {}`); continue; }
      // Put the first key on the dash line
      inner[0] = `${prefix}- ${inner[0].slice(indent + 2)}`;
      lines.push(...inner);
    } else {
      lines.push(`${prefix}- ${serializeScalar(item)}`);
    }
  }
  return lines;
}

/** Multi-line strings that round-trip cleanly through a `|-` block. */
function canUseBlockLiteral(s) {
  if (!s.includes('\n') || s.endsWith('\n') || /[\r\t\0]/.test(s)) return false;
  const lines = s.split('\n');
  if (/^\s/.test(lines[0])) return false;
  return lines.every(l => l === '' || (l.trim() !== '' && !/\s$/.test(l)));
}

function serializeKey(key) {
  if (/^[A-Za-z0-9_][\w.\-/ ]*$/.test(key) && !/\s$/.test(key) && parseScalar(key) === key) return key;
  return quoteDouble(key);
}

function needsQuote(s) {
  if (s === '') return true;
  if (s !== s.trim()) return true;
  if (/[\n\r\t\0\x7f-\x9f]/.test(s) || /[\x00-\x1f]/.test(s)) return true;
  // Anything the parser would read back as a non-string (numbers, booleans, null, ~)
  if (parseScalar(s) !== s) return true;
  if (/^[-+]?(\d|\.\d)/.test(s) || /^[-+.]?(inf|nan)$/i.test(s)) return true;
  if (/^(yes|no|on|off|y|n)$/i.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/: |:$| #/.test(s)) return true;
  return /[:#{}[\],&*?|>!%@`]/.test(s);
}

function quoteDouble(s) {
  const body = String(s).replace(/[\\"\x00-\x1f\x7f]/g, ch => {
    switch (ch) {
      case '\\': return '\\\\';
      case '"': return '\\"';
      case '\n': return '\\n';
      case '\t': return '\\t';
      case '\r': return '\\r';
      default: return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    }
  });
  return `"${body}"`;
}

function serializeScalar(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val.toString();
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : quoteDouble(String(val));
  if (val instanceof Date) return quoteDouble(val.toISOString());
  if (typeof val === 'bigint') return String(val);
  const s = String(val);
  return needsQuote(s) ? quoteDouble(s) : s;
}
