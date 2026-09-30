import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from '../../src/utils/yaml.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const roundTrip = value => parse(stringify(value));

test('parses lists of objects', () => {
  const doc = 'items:\n  - name: a\n    url: b\n  - name: c\n';
  assert.deepEqual(parse(doc), { items: [{ name: 'a', url: 'b' }, { name: 'c' }] });
});

test('parses zero-indented lists under a key', () => {
  const doc = 'sources:\n- local\n- https://x.com/a\nother: 1\n';
  assert.deepEqual(parse(doc), { sources: ['local', 'https://x.com/a'], other: 1 });
});

test('parses nested maps, booleans, inline + block lists, comments, quotes', () => {
  const doc = [
    '# top comment',
    'version: 1',
    'project:',
    '  name: "my app"   # trailing comment',
    "  language: 'type: script'",
    'providers:',
    '  claude: true',
    '  cursor: false',
    'rules:',
    '  sources: [local, "a,b", \'c\']',
    'context:',
    '  include:',
    '    - src/',
    '    - "*.lock"',
    '  max_tokens: 100000',
    'empty:',
    '',
  ].join('\n');
  assert.deepEqual(parse(doc), {
    version: 1,
    project: { name: 'my app', language: 'type: script' },
    providers: { claude: true, cursor: false },
    rules: { sources: ['local', 'a,b', 'c'] },
    context: { include: ['src/', '*.lock'], max_tokens: 100000 },
    empty: null,
  });
});

test('parses flow maps and nested flow collections', () => {
  assert.deepEqual(parse('a: {x: 1, y: [2, "3"]}\nb: []\nc: {}'), { a: { x: 1, y: [2, '3'] }, b: [], c: {} });
});

test('parses block scalars', () => {
  assert.deepEqual(parse('a: |\n  line 1\n    indented\n  line 3\nb: x'), { a: 'line 1\n  indented\nline 3\n', b: 'x' });
  assert.deepEqual(parse('a: |-\n  one\n  two\n'), { a: 'one\ntwo' });
  assert.deepEqual(parse('a: >-\n  one\n  two\n'), { a: 'one two' });
});

test('keeps URLs with colons and # fragments intact', () => {
  assert.deepEqual(parse('u: https://example.com:8080/path#frag\nlist:\n  - https://a.b/c:d\n'), {
    u: 'https://example.com:8080/path#frag',
    list: ['https://a.b/c:d'],
  });
});

test('stringify round-trips empty collections', () => {
  assert.deepEqual(roundTrip({ a: [], b: {}, c: { d: [] } }), { a: [], b: {}, c: { d: [] } });
  assert.equal(stringify({}), '{}');
  assert.deepEqual(parse(stringify({})), {});
});

test('stringify({a:[{}]}) does not throw and round-trips', () => {
  assert.doesNotThrow(() => stringify({ a: [{}] }));
  assert.deepEqual(roundTrip({ a: [{}] }), { a: [{}] });
});

test('stringify quotes numeric-looking strings, ~, booleans and null words', () => {
  const value = { a: '123', b: '1.5', c: '~', d: 'true', e: 'null', f: '-7', g: '0x1F', h: '', i: 'yes' };
  const out = stringify(value);
  assert.match(out, /a: "123"/);
  assert.match(out, /c: "~"/);
  assert.deepEqual(parse(out), value);
});

test('stringify escapes whitespace and newlines safely', () => {
  const value = {
    lead: '  padded',
    trail: 'padded  ',
    nl: 'a\nb',
    endsNl: 'a\n',
    tab: 'a\tb',
    quote: 'say "hi" \\ bye',
    hash: 'a # not a comment',
    colon: 'key: value',
    dash: '- item',
    unicode: 'héllo ✓',
    cr: 'a\r\nb',
  };
  assert.deepEqual(roundTrip(value), value);
});

test('nested objects inside lists serialize (never [object Object])', () => {
  const value = {
    items: [
      { name: 'a', meta: { tags: ['x', 'y'], deep: { z: 1 } } },
      { name: 'b', list: [{ k: 'v' }, [1, 2], []] },
      'plain',
      42,
      null,
    ],
  };
  const out = stringify(value);
  assert.doesNotMatch(out, /\[object Object\]/);
  assert.deepEqual(parse(out), value);
});

test('round-trips DEFAULT-like config and profile shapes', () => {
  const config = {
    version: 1,
    project: { name: null, language: 'typescript', framework: 'Next.js' },
    providers: { claude: true, cursor: false },
    rules: { sources: ['local', 'https://github.com/org/rules'] },
    context: { include: ['src/', 'lib/'], exclude: ['*.lock', 'node_modules/'], max_tokens: 100000 },
  };
  assert.deepEqual(roundTrip(config), config);
});

test('quotes awkward keys', () => {
  const value = { 'a b': 1, '200': 'ok', 'x: y': 2, '': 3 };
  assert.deepEqual(roundTrip(value), value);
});

test('parses every YAML file shipped in the repo without throwing', () => {
  for (const rel of ['templates/config.yaml', 'templates/profile.yaml', '.cortex/config.yaml']) {
    let text;
    try { text = readFileSync(join(ROOT, rel), 'utf-8'); } catch { continue; }
    const parsed = parse(text);
    assert.equal(typeof parsed, 'object', rel);
  }
});

test('empty and comment-only documents parse to {}', () => {
  assert.deepEqual(parse(''), {});
  assert.deepEqual(parse('# only a comment\n\n'), {});
  assert.deepEqual(parse(undefined), {});
});
