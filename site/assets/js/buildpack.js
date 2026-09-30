// ─────────────────────────────────────────────────────────────────────────────
// Build Pack — the output of the Lab. Pure functions (no DOM):
//   plan inputs → clarity score, architecture, skeleton, cost, learning path,
//   phased prompts and PLAN.md.
//
// Philosophy: think before you prompt. Every section exists to make the
// developer clearer about what they are building BEFORE an AI tool writes code.
// ─────────────────────────────────────────────────────────────────────────────

// ── Personas: different developers, different doors into the same lab ──────
export const PERSONAS = [
  { id: 'pick', title: 'Just exploring', who: 'Curious, casual, want to see options', does: 'Pick technologies and see what they’re good for and what you could build.', time: '2 min', icon: 'compass' },
  { id: 'guide', title: 'Point me in a direction', who: 'Have an idea, want a sensible default', does: 'Answer a few questions and get a proven starter stack with reasons.', time: '4 min', icon: 'signpost' },
  { id: 'architect', title: 'I’m serious about this', who: 'Building something that has to last', does: 'Define the problem, users and edge, then scale, data, compliance — and get a full blueprint.', time: '10 min', icon: 'blueprint' },
  { id: 'extend', title: 'I have an existing product', who: 'Adding a feature to a real codebase', does: 'Map your current stack, say what you’re adding and what must not break.', time: '5 min', icon: 'layers' },
];

// ── Intent steps (free text) — the thinking most people skip ───────────────
export const INTENT_STEPS = {
  idea: { id: 'idea', type: 'text', short: 'Idea', question: 'In one or two sentences, what are you building?', hint: 'Plain words. If you can’t say it simply, no AI tool can build it well.', placeholder: 'e.g. A booking app that lets physiotherapy clinics fill cancelled slots from a waitlist automatically.', minLength: 20 },
  users: { id: 'users', type: 'text', short: 'Users', question: 'Who is it for, and what do they do today without it?', hint: 'Name a real person or role. “Everyone” is not a user.', placeholder: 'e.g. Front-desk staff at 2–10 therapist clinics; today they phone waitlisted patients one by one.', minLength: 15 },
  moat: { id: 'moat', type: 'text', short: 'Edge', question: 'Why would someone choose yours over what already exists?', hint: 'Your edge (data, workflow, distribution, speed, price, niche). This protects you from building a commodity.', placeholder: 'e.g. Integrates with the clinic’s existing calendar in 5 minutes; competitors need a full migration.', minLength: 15 },
  success: { id: 'success', type: 'text', short: 'Success', question: 'What does success look like in 90 days? Use a number.', hint: 'A measurable target keeps you from gold-plating features nobody needs.', placeholder: 'e.g. 20 clinics live, 30% of cancelled slots refilled within 24 hours.', minLength: 10 },
  feature: { id: 'feature', type: 'text', short: 'Feature', question: 'What are you adding to your product?', hint: 'One feature. Scope it like a ticket, not a roadmap.', placeholder: 'e.g. Let admins export monthly invoices as PDF and email them to customers.', minLength: 15 },
  guardrails: { id: 'guardrails', type: 'text', short: 'Must not break', question: 'What must not break or change?', hint: 'APIs, data, performance, styles — the things an eager AI agent will happily rewrite.', placeholder: 'e.g. Public REST API v1, the billing tables, and page load under 1s on the dashboard.', minLength: 10 },
};

export const GUIDE_INTENT = [{ ...INTENT_STEPS.idea, optional: true }];
export const ARCH_INTENT = [INTENT_STEPS.idea, INTENT_STEPS.users, INTENT_STEPS.moat, INTENT_STEPS.success];
export const EXTEND_INTENT = [INTENT_STEPS.feature, INTENT_STEPS.guardrails];

const txt = v => (typeof v === 'string' ? v.trim() : '');
const has = (v, n = 10) => txt(v).length >= n;

// ── Clarity gate ────────────────────────────────────────────────────────────
/**
 * @param {object} ctx { persona, intent, answers, selected: string[], catalog: Map }
 * @returns {{ score, level, label, checks: [{ok, weight, title, fix}] }}
 */
export function clarity(ctx) {
  const { persona, intent = {}, answers = {}, selected = [] } = ctx;
  const cat = id => ctx.catalog?.get(id)?.category;
  const cats = new Set(selected.map(cat));
  const checks = [];
  const add = (ok, weight, title, fix) => checks.push({ ok: !!ok, weight, title, fix });

  if (persona === 'extend') {
    add(has(intent.feature, 15), 25, 'The feature is scoped', 'Describe the one feature you are adding, like a ticket.');
    add(has(intent.guardrails, 10), 20, 'You named what must not break', 'List the APIs, data and behaviour an AI agent must leave alone.');
    add(selected.length >= 2, 20, 'Your existing stack is mapped', 'Select the technologies already in your codebase.');
    add(cats.has('tools'), 10, 'You chose the AI tool(s) you’ll use', 'Pick the coding tools so the rules compile to the right files.');
  } else {
    add(has(intent.idea, 20), 20, 'You can say what you’re building', 'Write the idea in one or two plain sentences.');
    if (persona === 'architect' || persona === 'guide') {
      add(has(intent.users, 15), 12, 'You know who it’s for', 'Name the user and what they do today without your product.');
      add(has(intent.moat, 15), 15, 'You know why you’d win', 'Write your edge — otherwise you’re building a commodity.');
      add(/\d/.test(txt(intent.success)), 10, 'Success is measurable', 'Add a 90-day target with a number in it.');
    }
    const scale = answers.scale || answers.speed;
    add(!!scale, 10, 'Scale / timeline is decided', persona === 'pick' ? 'Use “Point me in a direction” or “I’m serious” to set scale.' : 'Answer the scale question.');
    const needsUI = !['api-service', 'data-platform'].includes(answers['project-type']) && answers.type !== 'api' && answers.type !== 'data';
    add((!needsUI || cats.has('frontend')) && cats.has('backend') && cats.has('database'), 13, 'The stack covers every layer', 'Make sure you have a frontend (if users see it), a backend and a database.');
    if (persona === 'architect') {
      add((answers['data-patterns'] || []).length > 0, 8, 'Data needs are considered', 'Answer the data-requirements question — it drives the architecture.');
      add((answers.compliance || []).length > 0, 5, 'Compliance is considered', 'Say “None yet” explicitly if there is none.');
      add(!!answers['auth-needs'], 5, 'Auth is decided', 'Pick an authentication approach.');
    }
    const wantsAI = answers['project-type'] === 'ai-product' || answers['core-workflow'] === 'ai-chat' || ['light', 'core', 'self'].includes(answers.ai);
    if (wantsAI) add(cats.has('ai'), 7, 'An AI model tier is chosen', 'Pick a model tier so cost and rules are concrete.');
  }
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter(c => c.ok).reduce((s, c) => s + c.weight, 0);
  const score = total ? Math.round((got / total) * 100) : 0;
  const level = score >= 80 ? 'ready' : score >= 50 ? 'almost' : 'blind';
  const label = { ready: 'Ready to build', almost: 'Almost — close the gaps first', blind: 'Not ready — you’d be prompting blind' }[level];
  return { score, level, label, checks };
}

// ── Architecture ────────────────────────────────────────────────────────────
const NAMES = {
  'html-css': 'Static site', react: 'React SPA', nextjs: 'Next.js', vue: 'Vue', angular: 'Angular', svelte: 'SvelteKit', 'react-native': 'React Native app',
  'node-express': 'Node.js API', 'python-django': 'Django', 'python-fastapi': 'FastAPI', 'ruby-rails': 'Rails', 'java-spring': 'Spring Boot', go: 'Go service', dotnet: 'ASP.NET Core', serverless: 'Serverless functions', graphql: 'GraphQL layer',
  postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', sqlite: 'SQLite', redis: 'Redis', elasticsearch: 'Search index', firebase: 'Firebase', supabase: 'Supabase (Postgres + auth)', pgvector: 'pgvector', pinecone: 'Pinecone',
  'cloud-managed': 'Managed cloud', docker: 'Docker', 'docker-k8s': 'Kubernetes', 'vercel-netlify': 'Vercel / Netlify', 'cloudflare-workers': 'Cloudflare Workers',
  stripe: 'Stripe', 'auth-provider': 'Auth provider', 'object-storage': 'Object storage (S3/R2)', speech: 'Speech API',
};

/**
 * Lanes left→right: who calls whom. Each node: { label, note }.
 */
export function architecture(ctx) {
  const s = new Set(ctx.selected || []);
  const a = ctx.answers || {};
  const cat = id => ctx.catalog?.get(id);
  const pick = ids => ids.filter(id => s.has(id));
  const node = (label, note = '') => ({ label, note });
  const scale = a.scale || (a.speed === 'months' ? 'small' : 'tiny');

  const clients = pick(['nextjs', 'react', 'vue', 'angular', 'svelte', 'react-native', 'html-css']).map(id => node(NAMES[id], cat(id)?.category === 'frontend' ? 'UI' : ''));
  if (!clients.length) clients.push(node(a['project-type'] === 'api-service' || a.type === 'api' ? 'API consumers' : 'Web / mobile client', 'not chosen yet'));

  const edge = [];
  for (const id of pick(['vercel-netlify', 'cloudflare-workers'])) edge.push(node(NAMES[id], 'hosting + CDN'));
  if (!edge.length && scale !== 'tiny') edge.push(node('CDN', 'cache static assets'));
  if (s.has('auth-provider') || a['auth-needs'] && a['auth-needs'] !== 'none' && !s.has('supabase')) edge.push(node('Auth provider', 'Clerk / Auth0 / WorkOS'));

  const app = pick(['nextjs', 'node-express', 'python-fastapi', 'python-django', 'ruby-rails', 'java-spring', 'go', 'dotnet', 'serverless', 'graphql'])
    .filter(id => id !== 'nextjs' || !pick(['node-express', 'python-fastapi', 'python-django', 'ruby-rails', 'java-spring', 'go', 'dotnet']).length)
    .map(id => node(id === 'nextjs' ? 'Next.js server (route handlers)' : NAMES[id], 'business logic'));
  if (!app.length) app.push(node('API / backend', 'not chosen yet'));
  const async = s.has('pat-job-queues') || (a['data-patterns'] || []).includes('write-heavy') || a['core-workflow'] === 'transactions';
  if (async) app.push(node('Background workers', 'queue: BullMQ / pg-boss / Celery'));
  if (s.has('pat-realtime') || (a['data-patterns'] || []).includes('realtime')) app.push(node('Realtime channel', 'presence, live updates'));

  const data = pick(['supabase', 'postgres', 'mysql', 'mongodb', 'firebase']).filter(id => !(id === 'postgres' && s.has('supabase'))).map(id => node(NAMES[id], 'system of record'));
  if (s.has('sqlite')) data.push(node(NAMES.sqlite, 'on-device / local-first'));
  if (!data.length) data.push(node('Database', 'not chosen yet'));
  for (const id of pick(['redis'])) data.push(node(NAMES[id], 'cache, sessions, rate limits'));
  for (const id of pick(['elasticsearch'])) data.push(node(NAMES[id], 'full-text search'));
  for (const id of pick(['pgvector', 'pinecone'])) data.push(node(NAMES[id], 'embeddings for RAG'));
  if (scale === 'large' || s.has('pat-cqrs')) data.push(node('Read replicas', 'analytics off the primary'));

  const services = [];
  for (const t of (ctx.selected || []).map(cat).filter(t => t?.category === 'ai')) services.push(node(t.model?.name || t.label, `LLM · ${t.tier || 'model'}`));
  for (const id of pick(['stripe', 'object-storage', 'speech'])) services.push(node(NAMES[id], id === 'stripe' ? 'payments + webhooks' : ''));
  services.push(node('Observability', 'errors, logs, uptime'));

  const lanes = [
    { id: 'clients', title: 'Clients', nodes: clients },
    { id: 'edge', title: 'Edge & identity', nodes: edge.length ? edge : [node('Direct to app', 'fine at this scale')] },
    { id: 'app', title: 'Application', nodes: app },
    { id: 'data', title: 'Data', nodes: data },
    { id: 'services', title: 'Services', nodes: services },
  ];
  const style = s.has('pat-microservices') ? 'Microservices' : async ? 'Modular monolith + workers' : 'Modular monolith';
  return { lanes, style };
}

// ── Skeleton ────────────────────────────────────────────────────────────────
const FE_TREES = {
  nextjs: ['app/', '  layout.tsx', '  page.tsx', '  (auth)/login/page.tsx', '  dashboard/page.tsx', '  api/health/route.ts', 'components/', '  ui/', 'lib/', '  db.ts', '  validation.ts'],
  react: ['src/', '  main.tsx', '  routes/', '  components/', '  hooks/', '  lib/api.ts', 'index.html', 'vite.config.ts'],
  vue: ['src/', '  main.ts', '  pages/', '  components/', '  composables/', '  stores/', 'vite.config.ts'],
  svelte: ['src/', '  routes/', '    +page.svelte', '    +layout.svelte', '  lib/', 'svelte.config.js'],
  angular: ['src/app/', '  core/', '  features/', '  shared/', '  app.routes.ts', 'angular.json'],
  'react-native': ['app/', '  (tabs)/index.tsx', '  _layout.tsx', 'components/', 'lib/', 'app.json'],
  'html-css': ['index.html', 'styles/', '  tokens.css', 'scripts/', 'assets/'],
};
const BE_TREES = {
  'node-express': ['src/', '  server.ts', '  routes/', '  services/', '  repos/', '  jobs/', '  lib/', 'prisma/schema.prisma'],
  'python-fastapi': ['app/', '  main.py', '  api/', '  services/', '  repos/', '  models/', '  schemas/', 'alembic/', 'pyproject.toml'],
  'python-django': ['config/', '  settings.py', '  urls.py', 'apps/', '  core/', '    models.py', '    views.py', '    tests/', 'manage.py'],
  'ruby-rails': ['app/', '  controllers/', '  models/', '  services/', '  jobs/', 'config/routes.rb', 'db/migrate/', 'Gemfile'],
  'java-spring': ['src/main/java/.../', '  api/', '  domain/', '  service/', '  repository/', 'src/main/resources/db/migration/', 'pom.xml'],
  go: ['cmd/api/main.go', 'internal/', '  http/', '  service/', '  store/', 'migrations/', 'go.mod'],
  dotnet: ['src/Api/', '  Endpoints/', '  Services/', '  Data/', 'tests/Api.Tests/', 'Api.sln'],
  serverless: ['functions/', '  health.ts', '  <feature>.ts', 'lib/', 'serverless.yml'],
};

export function skeleton(ctx) {
  const s = new Set(ctx.selected || []);
  const name = ctx.name || 'my-app';
  const fe = Object.keys(FE_TREES).find(id => s.has(id));
  const be = Object.keys(BE_TREES).find(id => s.has(id));
  const lines = [`${name}/`];
  const push = (arr, indent) => arr.forEach(l => lines.push(indent + l));
  const monorepo = fe && be && !(fe === 'nextjs' && be === 'node-express');
  if (monorepo) {
    lines.push('  apps/', '    web/');
    push(FE_TREES[fe], '      ');
    lines.push('    api/');
    push(BE_TREES[be], '      ');
    lines.push('  packages/', '    shared/          # types / API contracts');
  } else if (fe || be) {
    push(FE_TREES[fe] || BE_TREES[be], '  ');
    if (fe && be && fe === 'nextjs') lines.push('  server/            # Node services behind route handlers');
  } else {
    lines.push('  src/               # choose a stack to see the real layout');
  }
  if ([...s].some(id => id.startsWith('ai-'))) lines.push('  src/llm/            # one module owns model ids, prompts, retries');
  lines.push('  tests/');
  if (s.has('docker') || s.has('docker-k8s') || s.has('postgres') || s.has('redis')) lines.push('  docker-compose.yml  # local Postgres/Redis');
  if (s.has('docker-k8s')) lines.push('  deploy/k8s/');
  lines.push('  docs/', '    PLAN.md            # this build pack', '    adr/0001-stack.md  # why this stack');
  lines.push('  .cortex/            # rules → CLAUDE.md, AGENTS.md, Cursor, Copilot…', '    config.yaml', '    rules/project.md');
  lines.push('  .github/workflows/ci.yml   # tests + `cortex compile --check`');
  lines.push('  .env.example');
  return lines.join('\n');
}

// ── Cost ────────────────────────────────────────────────────────────────────
const USERS = { tiny: 500, small: 10_000, medium: 150_000, large: 1_000_000 };
const INFRA = { // USD / month, order of magnitude
  paas: { tiny: [0, 50], small: [50, 400], medium: [400, 3000], large: [3000, 20000] },
  cloud: { tiny: [30, 120], small: [150, 700], medium: [800, 5000], large: [5000, 40000] },
  selfhost: { tiny: [50, 200], small: [200, 1000], medium: [1000, 6000], large: [6000, 50000] },
};
const ADDONS = { redis: [10, 200], elasticsearch: [50, 800], pinecone: [70, 500], 'object-storage': [5, 300], 'docker-k8s': [300, 1500], stripe: [0, 0] };

export function cost(ctx, registry) {
  const s = new Set(ctx.selected || []);
  const a = ctx.answers || {};
  const scale = a.scale || (a.speed === 'months' ? 'small' : a.speed ? 'tiny' : 'tiny');
  const profile = s.has('docker-k8s') || a.infra === 'on-prem' ? 'selfhost' : s.has('vercel-netlify') || s.has('supabase') || s.has('firebase') || s.has('cloudflare-workers') || a.infra === 'serverless' ? 'paas' : 'cloud';
  const base = INFRA[profile][scale];
  const lines = [{ item: { paas: 'Managed hosting + database', cloud: 'Cloud VMs/containers + managed DB', selfhost: 'Cluster / self-hosted infra' }[profile], range: base }];
  for (const [id, r] of Object.entries(ADDONS)) if (s.has(id) && r[1]) lines.push({ item: NAMES[id], range: scale === 'tiny' ? [r[0], Math.round(r[1] / 4)] : r });
  lines.push({ item: 'Monitoring, email, domains', range: scale === 'tiny' ? [0, 30] : [30, 300] });
  const infra = lines.reduce((acc, l) => [acc[0] + l.range[0], acc[1] + l.range[1]], [0, 0]);

  // AI runtime: requests/user/month × tokens × live price
  const ai = [];
  const aiChips = (ctx.selected || []).map(id => ctx.catalog?.get(id)).filter(t => t?.category === 'ai' && t.model);
  if (aiChips.length) {
    const heavy = a['project-type'] === 'ai-product' || a['core-workflow'] === 'ai-chat' || a.ai === 'core';
    const reqPerUser = heavy ? 150 : 20;
    const tin = 2500, tout = 600;
    const users = USERS[scale];
    const cheap = ['anthropic.haiku', 'openai.luna', 'google.flash'].map(k => { const [v, t] = k.split('.'); const id = registry?.highlights?.[v]?.[t]; return id && registry.models[id]; }).filter(Boolean)
      .sort((x, y) => x.costPer1M.input - y.costPer1M.input)[0];
    for (const m of [...aiChips.map(t => t.model), cheap].filter(Boolean).filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)) {
      const monthly = users * reqPerUser * (tin * m.costPer1M.input + tout * m.costPer1M.output) / 1e6;
      ai.push({ model: m, monthly, assumption: `${users.toLocaleString()} users × ${reqPerUser} requests × ${tin.toLocaleString()} in / ${tout} out tokens` });
    }
  }
  return { scale, users: USERS[scale], profile, lines, infra, ai };
}

// ── Learning path (Academy) ─────────────────────────────────────────────────
const YT = h => ({ name: h.name, url: `https://www.youtube.com/@${h.handle}` });
export const CH = {
  fcc: { name: 'freeCodeCamp', handle: 'freecodecamp' }, fireship: { name: 'Fireship', handle: 'Fireship' }, traversy: { name: 'Traversy Media', handle: 'TraversyMedia' },
  wds: { name: 'Web Dev Simplified', handle: 'WebDevSimplified' }, ninja: { name: 'Net Ninja', handle: 'NetNinja' }, jherr: { name: 'Jack Herrington', handle: 'jherr' },
  theo: { name: 'Theo — t3.gg', handle: 't3dotgg' }, matt: { name: 'Matt Pocock', handle: 'mattpocockuk' }, kevin: { name: 'Kevin Powell', handle: 'KevinPowell' },
  vercel: { name: 'Vercel', handle: 'VercelHQ' }, nextjs: { name: 'Next.js', handle: 'nextjs' }, corey: { name: 'Corey Schafer', handle: 'coreyms' }, arjan: { name: 'ArjanCodes', handle: 'ArjanCodes' },
  hussein: { name: 'Hussein Nasser', handle: 'hnasr' }, bbg: { name: 'ByteByteGo', handle: 'ByteByteGo' }, nana: { name: 'TechWorld with Nana', handle: 'TechWorldwithNana' },
  supabase: { name: 'Supabase', handle: 'Supabase' }, stripe: { name: 'Stripe Developers', handle: 'StripeDev' }, anthropic: { name: 'Anthropic', handle: 'anthropic-ai' },
  openai: { name: 'OpenAI', handle: 'OpenAI' }, google: { name: 'Google for Developers', handle: 'GoogleDevelopers' }, docker: { name: 'Docker', handle: 'DockerInc' },
  firebase: { name: 'Firebase', handle: 'Firebase' }, cloudflare: { name: 'Cloudflare Developers', handle: 'CloudflareDevelopers' }, spring: { name: 'Spring', handle: 'SpringSourceDev' },
  dotnet: { name: '.NET', handle: 'dotnet' }, gorails: { name: 'GoRails', handle: 'GoRailsTV' }, rails: { name: 'Ruby on Rails', handle: 'railsofficial' }, angular: { name: 'Angular', handle: 'Angular' },
  vuemastery: { name: 'Vue Mastery', handle: 'VueMastery' }, huntabyte: { name: 'Huntabyte', handle: 'Huntabyte' }, notjust: { name: 'notJust.dev', handle: 'notjustdev' },
  mongodb: { name: 'MongoDB', handle: 'MongoDB' }, redis: { name: 'Redis', handle: 'Redisinc' }, pinecone: { name: 'Pinecone', handle: 'pinecone-io' }, prisma: { name: 'Prisma', handle: 'PrismaData' },
  tailwind: { name: 'Tailwind Labs', handle: 'Tailwindlabs' }, fastapi: { name: 'FastAPI', handle: 'FastAPI' }, melkey: { name: 'Melkey', handle: 'MelkeyDev' }, elastic: { name: 'Elastic', handle: 'OfficialElasticCommunity' },
  amigos: { name: 'Amigoscode', handle: 'Amigoscode' }, cursor: { name: 'Cursor', handle: 'cursor_ai' }, github: { name: 'GitHub', handle: 'GitHub' }, windsurf: { name: 'Windsurf', handle: 'Windsurf' }, aie: { name: 'AI Engineer', handle: 'aiDotEngineer' },
};
export const LEARN = {
  'html-css': { docs: 'https://developer.mozilla.org/en-US/docs/Learn', ch: ['kevin', 'traversy'] },
  react: { docs: 'https://react.dev/learn', ch: ['jherr', 'wds'] }, nextjs: { docs: 'https://nextjs.org/learn', ch: ['nextjs', 'vercel', 'theo'] },
  vue: { docs: 'https://vuejs.org/guide/introduction.html', ch: ['vuemastery', 'ninja'] }, angular: { docs: 'https://angular.dev/tutorials', ch: ['angular'] },
  svelte: { docs: 'https://svelte.dev/tutorial', ch: ['huntabyte'] }, tailwind: { docs: 'https://tailwindcss.com/docs', ch: ['tailwind'] }, typescript: { docs: 'https://www.typescriptlang.org/docs/', ch: ['matt'] },
  'react-native': { docs: 'https://reactnative.dev/docs/getting-started', ch: ['notjust'] },
  'node-express': { docs: 'https://nodejs.org/en/learn', ch: ['traversy', 'ninja'] }, 'python-fastapi': { docs: 'https://fastapi.tiangolo.com/tutorial/', ch: ['fastapi', 'arjan'] },
  'python-django': { docs: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/', ch: ['corey'] }, 'ruby-rails': { docs: 'https://guides.rubyonrails.org/', ch: ['rails', 'gorails'] },
  'java-spring': { docs: 'https://spring.io/guides', ch: ['spring', 'amigos'] }, go: { docs: 'https://go.dev/learn/', ch: ['melkey'] }, dotnet: { docs: 'https://learn.microsoft.com/aspnet/core/', ch: ['dotnet'] },
  postgres: { docs: 'https://www.postgresql.org/docs/current/tutorial.html', ch: ['hussein', 'prisma'] }, mongodb: { docs: 'https://www.mongodb.com/docs/manual/tutorial/getting-started/', ch: ['mongodb'] },
  redis: { docs: 'https://redis.io/learn', ch: ['redis'] }, elasticsearch: { docs: 'https://www.elastic.co/guide/index.html', ch: ['elastic'] }, supabase: { docs: 'https://supabase.com/docs', ch: ['supabase'] },
  firebase: { docs: 'https://firebase.google.com/docs', ch: ['firebase'] }, pgvector: { docs: 'https://github.com/pgvector/pgvector', ch: ['supabase', 'aie'] }, pinecone: { docs: 'https://docs.pinecone.io/', ch: ['pinecone'] },
  docker: { docs: 'https://docs.docker.com/get-started/', ch: ['docker', 'nana'] }, 'docker-k8s': { docs: 'https://kubernetes.io/docs/tutorials/', ch: ['nana'] },
  'vercel-netlify': { docs: 'https://vercel.com/docs', ch: ['vercel'] }, 'cloudflare-workers': { docs: 'https://developers.cloudflare.com/workers/', ch: ['cloudflare'] },
  stripe: { docs: 'https://docs.stripe.com/', ch: ['stripe'] },
};

export function learningPath(ctx) {
  const items = [];
  const seen = new Set();
  for (const id of ctx.selected || []) {
    const t = ctx.catalog?.get(id);
    if (!t) continue;
    let entry = LEARN[id];
    if (!entry && t.category === 'ai') entry = { docs: { anthropic: 'https://docs.claude.com', openai: 'https://platform.openai.com/docs', google: 'https://ai.google.dev/gemini-api/docs' }[t.vendor] || null, ch: [{ anthropic: 'anthropic', openai: 'openai', google: 'google' }[t.vendor] || 'aie', 'aie'] };
    if (!entry && t.category === 'tools') entry = { docs: null, ch: [{ 'tool-claude': 'anthropic', 'tool-cursor': 'cursor', 'tool-copilot': 'github', 'tool-windsurf': 'windsurf', 'tool-codex': 'openai', 'tool-gemini': 'google' }[id] || 'aie'] };
    if (!entry || seen.has(t.label)) continue;
    seen.add(t.label);
    items.push({
      id, label: t.label, category: t.category,
      docs: entry.docs,
      channels: [...new Set(entry.ch)].map(k => CH[k]).filter(Boolean).map(YT),
      search: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.label} tutorial ${new Date().getFullYear()}`)}`,
    });
  }
  const foundations = [YT(CH.bbg), YT(CH.hussein), YT(CH.fireship), YT(CH.fcc)];
  const stackQuery = (ctx.selected || []).map(id => ctx.catalog?.get(id)).filter(t => t && ['frontend', 'backend', 'database'].includes(t.category)).slice(0, 3).map(t => t.label).join(' ');
  const buildAlong = stackQuery ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`build full app ${stackQuery}`)}` : null;
  return { items, foundations, buildAlong };
}

// ── Prompts (phased) ────────────────────────────────────────────────────────
function brief(ctx) {
  const { intent = {}, answers = {}, rec, selected = [] } = ctx;
  const t = id => ctx.catalog?.get(id);
  const stack = selected.map(t).filter(x => x && !['tools', 'patterns'].includes(x.category)).map(x => x.category === 'ai' ? `${x.model?.name || x.label} (${x.model?.id || x.tier})` : x.label);
  const b = ['# Project brief'];
  if (txt(intent.idea)) b.push(`What: ${txt(intent.idea)}`);
  if (txt(intent.users)) b.push(`For: ${txt(intent.users)}`);
  if (txt(intent.moat)) b.push(`Our edge (protect it): ${txt(intent.moat)}`);
  if (txt(intent.success)) b.push(`Success in 90 days: ${txt(intent.success)}`);
  if (txt(intent.feature)) b.push(`Feature to add: ${txt(intent.feature)}`);
  if (txt(intent.guardrails)) b.push(`Must not break: ${txt(intent.guardrails)}`);
  const scale = { tiny: '< 1K users', small: '1K–50K users', medium: '50K–500K users', large: '500K+ users' }[answers.scale];
  if (scale) b.push(`Scale target (12 months): ${scale}`);
  if (stack.length) b.push(`Stack (decided — do not substitute): ${stack.join(', ')}`);
  if (rec?.patterns?.length) b.push(`Architecture: ${rec.patterns.map(p => p.name).join(', ')}`);
  const comp = (answers.compliance || []).filter(c => c !== 'none');
  if (comp.length) b.push(`Compliance: ${comp.map(c => c.toUpperCase()).join(', ')}`);
  if (rec?.traps?.length) b.push(`Known traps to avoid: ${rec.traps.map(x => x.title).join('; ')}`);
  return b.join('\n');
}

const RULES_OF_ENGAGEMENT = `Rules of engagement:
- Follow the project rules in CLAUDE.md / AGENTS.md (generated by Cortex).
- Ask before adding any dependency, service or framework not listed above.
- Work in small steps; after each step run the tests and stop to summarise what changed and what is next.`;

export function prompts(ctx) {
  const b = brief(ctx);
  const a = ctx.answers || {};
  const core = { crud: 'create, edit and list the main records', collab: 'real-time collaborative editing of the main object', transactions: 'the purchase / booking / transfer flow', content: 'publishing and reading the main content feed', 'search-discovery': 'search and discovery of the main items', 'ai-chat': 'the AI-assisted core workflow (streamed responses)', 'analytics-view': 'the main dashboard with real data' }[a['core-workflow']] || 'the single most important user action';

  if (ctx.persona === 'extend') {
    return [
      { title: 'Map the codebase', when: 'Before any change', prompt: `${b}\n\nRead the codebase before writing anything. Produce: (1) a map of the modules this feature will touch, (2) the existing patterns I must follow (data access, validation, errors, tests), (3) risks to the "must not break" list. Do not write code yet.\n\n${RULES_OF_ENGAGEMENT}` },
      { title: 'Plan the change', when: 'After you agree with the map', prompt: `Using the map you produced, write a step-by-step implementation plan for the feature with the files to change, the tests to add, and how we will ship it behind a flag. Flag anything that could break the "must not break" list. Wait for my approval.` },
      { title: 'Implement behind a flag', when: 'After the plan is approved', prompt: `Implement step 1 of the approved plan only, behind a feature flag, with tests. Run the full test suite. Stop and summarise.` },
      { title: 'Verify & harden', when: 'Before merging', prompt: `Review the whole change against the "must not break" list, add regression tests for each item, check performance of touched endpoints, and list anything left for follow-up.` },
    ];
  }
  return [
    { title: 'Challenge the plan', when: 'First — no code', prompt: `${b}\n\nBefore writing any code, act as a senior architect reviewing this plan. List the 5 riskiest assumptions, requirements I have not specified, and questions you need answered. Push back where the stack or scope is wrong for the goal. Do not write code yet.` },
    { title: 'Scaffold the skeleton', when: 'After you answered its questions', prompt: `${b}\n\nCreate the project skeleton exactly as below — tooling, lint/format, test runner, CI, environment config and a /health endpoint. No product features yet.\n\n${ctx.tree}\n\n${RULES_OF_ENGAGEMENT}` },
    { title: 'Build the first vertical slice', when: 'Skeleton runs and tests pass', prompt: `Implement ${core} end to end — UI → API → database — with validation, error handling and tests. Only this slice. Keep business logic out of route handlers.\n\n${RULES_OF_ENGAGEMENT}` },
    { title: 'Data, auth & integrations', when: 'Slice works', prompt: `Add ${[a['auth-needs'] && a['auth-needs'] !== 'none' ? 'authentication via a managed provider' : null, (a['data-patterns'] || []).filter(p => p !== 'none').length ? `support for: ${(a['data-patterns'] || []).filter(p => p !== 'none').join(', ')}` : null, 'schema migrations for every table'].filter(Boolean).join('; ')}. One concern per step, tests for each.` },
    { title: 'Harden for launch', when: 'Before real users', prompt: `Audit the codebase for these known traps and fix them: ${(ctx.rec?.traps || []).map(t => t.title).join('; ') || 'N+1 queries; missing indexes; no monitoring; secrets in code'}. Add error tracking, structured logs and uptime checks. List remaining risks.` },
  ];
}

// ── PLAN.md ─────────────────────────────────────────────────────────────────
export function planMarkdown(ctx, parts) {
  const { clarityRes, arch, tree, costRes, learn, phases } = parts;
  const money = n => `$${Math.round(n).toLocaleString()}`;
  const md = [`# ${ctx.name || 'Project'} — build plan`, '', `_Generated by Cortex Lab (https://cortex1.vercel.app) on ${new Date().toISOString().slice(0, 10)}. Clarity: ${clarityRes.score}/100 — ${clarityRes.label}._`, ''];
  md.push(brief(ctx), '');
  const gaps = clarityRes.checks.filter(c => !c.ok);
  if (gaps.length) md.push('## Open gaps (close these before building)', ...gaps.map(g => `- [ ] ${g.title}: ${g.fix}`), '');
  md.push(`## Architecture — ${arch.style}`, ...arch.lanes.map(l => `- **${l.title}:** ${l.nodes.map(n => n.label + (n.note ? ` (${n.note})` : '')).join(', ')}`), '');
  if (ctx.rec?.traps?.length) md.push('## Traps to avoid', ...ctx.rec.traps.map(t => `- **${t.title}:** ${t.text}`), '');
  if (ctx.rec?.scalingRoadmap?.length) md.push('## Scaling roadmap', ...ctx.rec.scalingRoadmap.map(s => `- ${s}`), '');
  md.push('## Skeleton', '```', tree, '```', '');
  md.push('## Cost (order of magnitude)', `Infrastructure at ~${costRes.users.toLocaleString()} users: ${money(costRes.infra[0])}–${money(costRes.infra[1])} / month`, ...costRes.lines.map(l => `- ${l.item}: ${money(l.range[0])}–${money(l.range[1])}`));
  for (const x of costRes.ai) md.push(`- AI with ${x.model.name}: ~${money(x.monthly)} / month (${x.assumption})`);
  md.push('');
  if (learn.items.length) md.push('## Learn before you build', ...learn.items.map(i => `- **${i.label}:** ${[i.docs && `[docs](${i.docs})`, ...i.channels.map(c => `[${c.name}](${c.url})`)].filter(Boolean).join(' · ')}`), '');
  md.push('## Build with AI — phase by phase', '');
  phases.forEach((p, i) => md.push(`### Phase ${i + 1}: ${p.title}`, `_${p.when}_`, '', '```text', p.prompt, '```', ''));
  return md.join('\n');
}

// ── Rules that keep the AI tools anchored to the vision ────────────────────
export function intentRules(intent = {}) {
  const r = [];
  if (txt(intent.idea)) r.push(`We are building: ${txt(intent.idea)}`);
  if (txt(intent.users)) r.push(`Primary user: ${txt(intent.users)}`);
  if (txt(intent.moat)) r.push(`! Our edge is: ${txt(intent.moat)} — never trade it away for convenience`);
  if (txt(intent.success)) r.push(`Success metric (90 days): ${txt(intent.success)}. Don't build what doesn't move it`);
  if (txt(intent.feature)) r.push(`Current feature in progress: ${txt(intent.feature)}`);
  if (txt(intent.guardrails)) r.push(`! Must not break: ${txt(intent.guardrails)}`);
  return r;
}
