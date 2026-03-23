/**
 * Minimal YAML parser/serializer — handles the subset cortex needs.
 * Supports: scalars, arrays, nested objects, comments, multiline strings,
 * inline arrays with quoted strings, block scalars (| and >).
 * No external dependencies.
 */

export function parse(text) {
  const lines = text.split('\n');
  return parseLines(lines, 0, 0).value;
}

function parseLines(lines, start, baseIndent) {
  const result = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    const indent = line.length - trimmed.length;
    if (indent < baseIndent) break;

    // Find the key:value split — respect quoted keys and values with colons
    const colonIdx = findKeyColonIndex(trimmed);
    if (colonIdx === -1) { i++; continue; }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawAfterColon = trimmed.slice(colonIdx + 1);
    const afterColon = stripInlineComment(rawAfterColon).trim();

    if (afterColon === '' || afterColon === '|' || afterColon === '>') {
      // Check if next line is a list or nested object
      const nextNonEmpty = findNextNonEmpty(lines, i + 1);
      if (nextNonEmpty < lines.length) {
        const nextTrimmed = lines[nextNonEmpty].trimStart();
        const nextIndent = lines[nextNonEmpty].length - nextTrimmed.length;

        if (nextIndent > indent && nextTrimmed.startsWith('- ')) {
          const arr = parseArray(lines, nextNonEmpty, nextIndent);
          result[key] = arr.value;
          i = arr.nextIndex;
          continue;
        } else if (nextIndent > indent) {
          if (afterColon === '|' || afterColon === '>') {
            const block = parseBlockScalar(lines, i + 1, nextIndent, afterColon);
            result[key] = block.value;
            i = block.nextIndex;
            continue;
          }
          const nested = parseLines(lines, nextNonEmpty, nextIndent);
          result[key] = nested.value;
          i = nested.nextIndex;
          continue;
        }
      }
      result[key] = afterColon === '' ? null : '';
      i++;
    } else if (afterColon.startsWith('[')) {
      result[key] = parseInlineArray(afterColon);
      i++;
    } else {
      result[key] = parseScalar(afterColon);
      i++;
    }
  }

  return { value: result, nextIndex: i };
}

function parseArray(lines, start, baseIndent) {
  const arr = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    const indent = line.length - trimmed.length;
    if (indent < baseIndent) break;

    if (trimmed.startsWith('- ')) {
      const itemContent = trimmed.slice(2).trim();

      // Check if it's a URL or value containing colons but not a key:value
      const isUrl = /^https?:\/\//.test(itemContent) || /^ftp:\/\//.test(itemContent);
      const isQuoted = itemContent.startsWith('"') || itemContent.startsWith("'");

      if (!isUrl && !isQuoted && itemContent.includes(':')) {
        const colonIdx = findKeyColonIndex(itemContent);
        if (colonIdx > 0) {
          const itemKey = itemContent.slice(0, colonIdx).trim();
          const afterColon = stripInlineComment(itemContent.slice(colonIdx + 1)).trim();
          const obj = {};
          obj[itemKey] = afterColon === '' ? null : parseScalar(afterColon);

          // Check for more keys at deeper indent
          const nextNonEmpty = findNextNonEmpty(lines, i + 1);
          if (nextNonEmpty < lines.length) {
            const nextLine = lines[nextNonEmpty];
            const nextIndent = nextLine.length - nextLine.trimStart().length;
            if (nextIndent > indent + 2 && !nextLine.trimStart().startsWith('- ')) {
              const nested = parseLines(lines, nextNonEmpty, nextIndent);
              Object.assign(obj, nested.value);
              i = nested.nextIndex;
              arr.push(obj);
              continue;
            }
          }
          arr.push(obj);
        } else {
          arr.push(parseScalar(itemContent));
        }
      } else {
        arr.push(parseScalar(itemContent));
      }
      i++;
    } else {
      break;
    }
  }

  return { value: arr, nextIndex: i };
}

function parseBlockScalar(lines, start, baseIndent, style) {
  const parts = [];
  let i = start;
  let detectedIndent = -1;

  while (i < lines.length) {
    const line = lines[i];

    // Empty lines are preserved in block scalars
    if (!line.trim()) {
      parts.push('');
      i++;
      continue;
    }

    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent < baseIndent) break;

    // Use the first line's indent as the base for stripping
    if (detectedIndent === -1) detectedIndent = lineIndent;

    // Preserve relative indentation beyond the base
    const stripped = lineIndent >= detectedIndent ? line.slice(detectedIndent) : line.trimStart();
    parts.push(stripped);
    i++;
  }

  // Trim trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

  const joiner = style === '|' ? '\n' : ' ';
  return { value: parts.join(joiner), nextIndex: i };
}

/**
 * Parse inline arrays, respecting quoted strings that may contain commas.
 * e.g. ["comma,inside", "other", plain, 42]
 */
function parseInlineArray(str) {
  const closeBracket = str.lastIndexOf(']');
  const inner = str.slice(1, closeBracket === -1 ? undefined : closeBracket).trim();
  if (!inner) return [];

  const items = [];
  let current = '';
  let inQuote = null;

  for (let c = 0; c < inner.length; c++) {
    const ch = inner[c];

    if (inQuote) {
      current += ch;
      if (ch === '\\' && c + 1 < inner.length) {
        current += inner[++c]; // skip escaped char
      } else if (ch === inQuote) {
        inQuote = null;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(parseScalar(current.trim()));
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) items.push(parseScalar(current.trim()));
  return items;
}

function parseScalar(str) {
  // Strip inline comments from bare values (but not from quoted strings)
  str = stripInlineComment(str).trim();

  if (str === '' || str === 'null' || str === '~') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);

  // Strip quotes, handle escape sequences in double-quoted strings
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    return str.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (str.startsWith("'") && str.endsWith("'") && str.length >= 2) {
    return str.slice(1, -1).replace(/''/g, "'");
  }

  return str;
}

/**
 * Find the colon that separates key from value, ignoring colons inside
 * quoted strings and URLs.
 */
function findKeyColonIndex(str) {
  let inQuote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === '\\') { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
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
      if (ch === '\\') { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
    if (ch === '#' && i > 0 && str[i - 1] === ' ') {
      return str.slice(0, i - 1);
    }
  }
  return str;
}

function findNextNonEmpty(lines, start) {
  let i = start;
  while (i < lines.length && (!lines[i].trim() || lines[i].trimStart().startsWith('#'))) i++;
  return i;
}

// ── Serializer ──────────────────────────────────────────────────────────────

export function stringify(obj, indent = 0) {
  const lines = [];
  const prefix = ' '.repeat(indent);

  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      lines.push(`${prefix}${key}:`);
    } else if (Array.isArray(val)) {
      lines.push(`${prefix}${key}:`);
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item);
          const [firstKey, firstVal] = entries[0];
          lines.push(`${prefix}  - ${firstKey}: ${serializeScalar(firstVal)}`);
          for (const [k, v] of entries.slice(1)) {
            lines.push(`${prefix}    ${k}: ${serializeScalar(v)}`);
          }
        } else {
          lines.push(`${prefix}  - ${serializeScalar(item)}`);
        }
      }
    } else if (typeof val === 'object') {
      lines.push(`${prefix}${key}:`);
      lines.push(stringify(val, indent + 2));
    } else if (typeof val === 'string' && val.includes('\n')) {
      lines.push(`${prefix}${key}: |`);
      for (const l of val.split('\n')) {
        lines.push(`${prefix}  ${l}`);
      }
    } else {
      lines.push(`${prefix}${key}: ${serializeScalar(val)}`);
    }
  }

  return lines.join('\n');
}

function serializeScalar(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val.toString();
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'string') {
    if (/[:#{}[\],&*?|>!%@`]/.test(val) || val === '' || val === 'true' || val === 'false' || val === 'null') {
      return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return val;
  }
  return String(val);
}
