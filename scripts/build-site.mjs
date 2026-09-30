#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Cortex — build the website (site/ → public/). Zero dependencies.
//
//   node scripts/build-site.mjs           build into public/
//   node scripts/build-site.mjs --serve   build, then serve on http://localhost:4173
//
// What it does:
//   1. Renders site/*.html, expanding <!--@include name key="value"--> partials.
//   2. Copies site/assets → public/assets.
//   3. Copies the pure engine (the exact code the CLI runs) → public/engine/,
//      so the playground compiles with the real compiler.
//   4. Copies registry/latest.json → public/data/registry.json (refreshed daily).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const out = join(root, 'public');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

let commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = ''; }
}
const build = (commit ? commit.slice(0, 7) : new Date().toISOString().slice(0, 10).replace(/-/g, ''));
const globals = { version: pkg.version, build };

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// ── Pages ──────────────────────────────────────────────────────────────────
const partials = Object.fromEntries(
  readdirSync(join(site, 'partials')).filter(f => f.endsWith('.html'))
    .map(f => [f.replace(/\.html$/, ''), readFileSync(join(site, 'partials', f), 'utf-8')]),
);

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? globals[k] ?? ''));
}

function render(html, pageVars) {
  return fill(html.replace(/<!--@include\s+(\w+)((?:\s+\w+="[^"]*")*)\s*-->/g, (_, name, attrs) => {
    if (!partials[name]) throw new Error(`Unknown partial: ${name}`);
    const vars = { ...pageVars };
    for (const [, k, v] of attrs.matchAll(/(\w+)="([^"]*)"/g)) vars[k] = v;
    return fill(partials[name], vars);
  }), pageVars);
}

const pages = [];
for (const file of readdirSync(site)) {
  if (!file.endsWith('.html') || file.startsWith('legacy')) continue;
  const html = readFileSync(join(site, file), 'utf-8');
  const path = file === 'index.html' ? '/' : `/${file}`;
  writeFileSync(join(out, file), render(html, { path }));
  pages.push(path);
}

// ── Assets, engine, data ───────────────────────────────────────────────────
cpSync(join(site, 'assets'), join(out, 'assets'), { recursive: true });

const engineFiles = [
  ...readdirSync(join(root, 'src', 'engine')).filter(f => f.endsWith('.js')).map(f => `src/engine/${f}`),
  'src/core/families.js',
  'src/core/registry-build.js',
  'src/utils/yaml.js',
];
for (const rel of engineFiles) {
  const src = readFileSync(join(root, rel), 'utf-8');
  if (/from\s+['"]node:/.test(src)) throw new Error(`${rel} imports a Node built-in and cannot ship to the browser`);
  mkdirSync(dirname(join(out, 'engine', rel)), { recursive: true });
  writeFileSync(join(out, 'engine', rel), src);
}

mkdirSync(join(out, 'data'), { recursive: true });
const registry = JSON.parse(readFileSync(join(root, 'registry', 'latest.json'), 'utf-8'));
writeFileSync(join(out, 'data', 'registry.json'), JSON.stringify(registry));
writeFileSync(join(out, 'data', 'build.json'), JSON.stringify({ version: pkg.version, commit, builtAt: new Date().toISOString() }));

// ── SEO ────────────────────────────────────────────────────────────────────
const origin = 'https://cortex1.vercel.app';
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${pages.length} page(s), ${engineFiles.length} engine module(s), ${registry.modelCount || Object.keys(registry.models).length} models → public/ (build ${build})`);

// ── Dev server ─────────────────────────────────────────────────────────────
if (process.argv.includes('--serve')) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
  const port = Number(process.env.PORT) || 4173;
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(out, p);
    if (!file.startsWith(out) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`Serving public/ at http://localhost:${port}`));
}
