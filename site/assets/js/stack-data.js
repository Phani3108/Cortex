// Stack Lab — content and pure logic (no DOM, no network).
//
// Everything here is plain data plus pure functions so it can be checked
// headlessly (node) and reused by the page. Two kinds of catalog entries:
//   • TECH          static technologies (frontend, backend, data, infra, services, patterns)
//   • MODEL_SLOTS   AI-model *slots* ("Anthropic Sonnet tier"). The concrete model id,
//                   name, price and context window are resolved at runtime from
//                   registry.highlights[vendor][key] — never hardcoded here.
//   • TOOL_SLOTS    AI coding tools, one per Cortex compile target (names come from TARGETS).
//
// Text may contain model placeholders like {{anthropic.sonnet}}; fillModels()
// swaps them for the current registry model name.

export const CATEGORIES = [
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'database', label: 'Data' },
  { id: 'cloud', label: 'Cloud / infra' },
  { id: 'services', label: 'Services' },
  { id: 'ai', label: 'AI models' },
  { id: 'tools', label: 'AI coding tools' },
  { id: 'patterns', label: 'Architecture patterns' },
];

// ── Static technology catalog ──────────────────────────────────────────────
// why:   one-line reasoning used in blueprints ("Core stack — and why")
// rules: bullets written into .cortex/rules (leading "! " = critical)
// lang / framework: feed project.language / project.framework in config.yaml
export const TECH = [
  // FRONTEND
  { id: 'html-css', label: 'HTML/CSS + JS', category: 'frontend', lang: 'JavaScript',
    bestFor: ['Static pages, landing pages, marketing sites', 'Simple UIs without heavy interactivity or frameworks', 'Zero build step, very fast delivery'],
    example: { app: 'Apple.com marketing pages', stack: ['HTML/CSS', 'Vanilla JS', 'Netlify'], highlight: 'HTML/CSS' },
    why: 'The simplest path to a live site: no build tooling, no framework overhead, nothing to upgrade.',
    rules: ['Use semantic HTML5 elements (header, nav, main, section, footer)', 'Lazy-load below-the-fold images and always set width/height', 'Meet WCAG 2.2 AA: visible focus, labelled controls, 4.5:1 text contrast', 'Theme with CSS custom properties; no inline styles'] },
  { id: 'react', label: 'React', category: 'frontend', lang: 'TypeScript', framework: 'React',
    bestFor: ['Dynamic, component-based UIs with reusable logic', 'SSR / SEO-heavy apps via Next.js', 'Largest ecosystem: hooks, routing, component libraries'],
    example: { app: 'Facebook / Instagram', stack: ['React', 'Node.js', 'MySQL', 'Redis'], highlight: 'React' },
    why: 'Battle-tested for complex UIs, with the largest talent pool and ecosystem. Figma, Notion and Linear are all React.',
    rules: ['Function components and hooks only; no class components', 'Keep components under ~150 lines; extract custom hooks for stateful logic', 'Derive state instead of syncing it with useEffect'] },
  { id: 'nextjs', label: 'Next.js', category: 'frontend', lang: 'TypeScript', framework: 'Next.js',
    bestFor: ['SSR + SSG + ISR in one framework, the default for SEO-heavy React apps', 'File-based routing, route handlers and middleware built in', 'Image, font and script optimization out of the box'],
    example: { app: 'Vercel / Hulu / TikTok web', stack: ['Next.js', 'React', 'PostgreSQL', 'Vercel'], highlight: 'Next.js' },
    why: 'React with server rendering, routing and data fetching decided for you, so the team ships features instead of plumbing.',
    rules: ['Server Components by default; add "use client" only for interactivity', 'Fetch data in Server Components or route handlers, never in useEffect', 'Keep secrets server-side: only NEXT_PUBLIC_* vars may reach the client'] },
  { id: 'vue', label: 'Vue', category: 'frontend', lang: 'TypeScript', framework: 'Vue',
    bestFor: ['Gentle learning curve with a reactive component model', 'Medium-size apps that need structure without complexity', 'Single-file components with templates, script and styles together'],
    example: { app: 'GitLab', stack: ['Vue', 'Ruby on Rails', 'PostgreSQL'], highlight: 'Vue' },
    why: 'Approachable and structured, with first-party router and state management.',
    rules: ['Use the Composition API with <script setup lang="ts">', 'Shared state lives in Pinia stores, not in ad-hoc reactive globals', 'Props down, events up; never mutate props'] },
  { id: 'angular', label: 'Angular', category: 'frontend', lang: 'TypeScript', framework: 'Angular',
    bestFor: ['Large enterprise apps that need strong typing from day one', 'Full framework: DI, forms, routing and HTTP built in', 'Opinionated structure for large teams'],
    example: { app: 'Google Workspace admin tools', stack: ['Angular', 'Java', 'PostgreSQL'], highlight: 'Angular' },
    why: 'Strong typing, dependency injection and a testing story that enterprise risk teams accept.',
    rules: ['Use standalone components and signals for new code', 'OnPush change detection on every component', 'Typed reactive forms; no template-driven forms for complex input'] },
  { id: 'svelte', label: 'Svelte / SvelteKit', category: 'frontend', lang: 'TypeScript', framework: 'SvelteKit',
    bestFor: ['Minimal boilerplate with a near-vanilla feel', 'Small bundles and fast runtime performance', 'SSR and routing built into SvelteKit'],
    example: { app: 'NY Times interactive features', stack: ['Svelte', 'Node.js', 'PostgreSQL'], highlight: 'Svelte / SvelteKit' },
    why: 'A compiler-first framework: less code to write, less JavaScript shipped.',
    rules: ['Load data in +page.server.ts load functions, not in onMount', 'Use form actions for mutations so pages work without JavaScript'] },
  { id: 'tailwind', label: 'Tailwind CSS', category: 'frontend',
    bestFor: ['Utility-first CSS: build custom UIs without leaving markup', 'Consistent design tokens across a team', 'Unused styles are removed in production builds'],
    example: { app: 'Many SaaS dashboards', stack: ['Tailwind', 'React', 'Next.js'], highlight: 'Tailwind CSS' },
    why: 'A shared design vocabulary that keeps UI consistent without a bespoke CSS architecture.',
    rules: ['Use theme tokens from tailwind config; no arbitrary hex values in class names', 'Extract a component when the same class list appears three times'] },
  { id: 'typescript', label: 'TypeScript', category: 'frontend', lang: 'TypeScript',
    bestFor: ['Static typing that catches bugs before production', 'Shared types between frontend and backend', 'Safe refactors and precise autocomplete in large codebases'],
    example: { app: 'Slack, Notion, VS Code', stack: ['TypeScript', 'React', 'Node.js'], highlight: 'TypeScript' },
    why: 'Types are documentation that the compiler checks, and they make AI-generated code far safer to accept.',
    rules: ['strict mode on; no `any` without a comment explaining why', 'Validate external data at runtime (zod or similar); types alone do not validate input'] },
  { id: 'react-native', label: 'React Native (Expo)', category: 'frontend', lang: 'TypeScript', framework: 'React Native',
    bestFor: ['One codebase for iOS and Android', 'Reuse React skills and TypeScript types from the web app', 'Over-the-air updates for JS changes via Expo'],
    example: { app: 'Shopify mobile, Discord, Microsoft Teams (parts)', stack: ['React Native', 'Expo', 'Node.js', 'PostgreSQL'], highlight: 'React Native (Expo)' },
    why: 'One codebase for iOS and Android. Meta, Shopify and Microsoft ship it, and 80%+ code sharing between platforms is realistic.',
    rules: ['Use Expo and EAS builds unless a native module makes that impossible', 'Design every screen for offline and slow networks; show cached data first', 'Never store tokens in AsyncStorage; use SecureStore / Keychain'] },

  // BACKEND
  { id: 'node-express', label: 'Node.js (Express / NestJS)', category: 'backend', lang: 'TypeScript', framework: 'Node.js',
    bestFor: ['JavaScript / TypeScript across the whole stack with shared types', 'Fast prototyping with the npm ecosystem', 'Real-time apps via WebSockets and event-driven I/O'],
    example: { app: 'LinkedIn, PayPal', stack: ['Node.js', 'React', 'PostgreSQL', 'Redis'], highlight: 'Node.js' },
    why: 'Same language front to back reduces context switching. Excellent for I/O-heavy APIs.',
    rules: ['async/await everywhere; never block the event loop with sync I/O or heavy CPU work', 'Route handlers stay thin: parse, call a service, return', 'Centralized error middleware returns structured errors; never leak stack traces'] },
  { id: 'python-django', label: 'Python + Django', category: 'backend', lang: 'Python', framework: 'Django',
    bestFor: ['Batteries included: ORM, auth and admin UI out of the box', 'Rapid builds for SaaS, dashboards and CMS-like apps', 'Strong conventions reduce decision fatigue'],
    example: { app: 'Instagram, Pinterest', stack: ['Python', 'Django', 'PostgreSQL', 'Redis'], highlight: 'Python + Django' },
    why: 'Admin, auth and ORM on day one. Instagram ran Django to a billion users.',
    rules: ['Use select_related / prefetch_related for every list view that touches relations', 'Business logic lives in services, not in views or model save()', 'Every schema change ships as a migration'] },
  { id: 'python-fastapi', label: 'Python + FastAPI', category: 'backend', lang: 'Python', framework: 'FastAPI',
    bestFor: ['Async, type-driven APIs with automatic OpenAPI docs', 'ML-backed services and LLM backends', 'Fast thanks to Starlette + Pydantic'],
    example: { app: 'Uber and Netflix ML services', stack: ['Python', 'FastAPI', 'PostgreSQL', 'Redis'], highlight: 'Python + FastAPI' },
    why: 'Python’s modern async API framework: built-in OpenAPI docs, Pydantic validation and the whole ML ecosystem next door.',
    rules: ['Every endpoint declares Pydantic request and response models', 'Inject DB sessions with Depends; never create sessions inside handlers', 'No blocking calls inside async def endpoints (use async clients or run_in_threadpool)'] },
  { id: 'ruby-rails', label: 'Ruby on Rails', category: 'backend', lang: 'Ruby', framework: 'Rails',
    bestFor: ['Rapid CRUD backends with strong conventions', 'Rich ecosystem of gems for common problems', 'Convention over configuration: great for MVPs'],
    example: { app: 'Shopify, GitHub', stack: ['Ruby on Rails', 'PostgreSQL', 'Redis', 'Elasticsearch'], highlight: 'Ruby on Rails' },
    why: 'The fastest path from schema to working product; Shopify and GitHub still run on it.',
    rules: ['Use includes/preload to avoid N+1 queries; keep Bullet enabled in development', 'Background work goes through ActiveJob, never inline in controllers'] },
  { id: 'java-spring', label: 'Java + Spring Boot', category: 'backend', lang: 'Java', framework: 'Spring Boot',
    bestFor: ['Large enterprise systems needing strict typing and a mature ecosystem', 'Strong DI, testing and long-term maintainability', 'Proven in high-scale finance and telecom'],
    example: { app: 'Netflix backend services', stack: ['Java', 'Spring Boot', 'Cassandra', 'Redis'], highlight: 'Java + Spring Boot' },
    why: 'Battle-tested for large teams and long-lived systems, with tooling for every enterprise concern.',
    rules: ['Constructor injection only; no field injection', 'Validate every request body with Bean Validation (@Valid)', 'Schema changes go through Flyway migrations', 'Every service exposes /health and /metrics via Actuator'] },
  { id: 'go', label: 'Go (Gin / Fiber / Chi)', category: 'backend', lang: 'Go', framework: 'Go',
    bestFor: ['High throughput with a small memory footprint', 'Microservices, CLIs and network-heavy tools', 'Fast compiles and single-binary deploys'],
    example: { app: 'Uber, Docker, Cloudflare', stack: ['Go', 'PostgreSQL', 'Redis', 'Kafka'], highlight: 'Go' },
    why: 'Compiled, statically typed and tiny at runtime. Ideal for high-throughput APIs and infrastructure tools.',
    rules: ['Propagate context.Context through every request path and honour cancellation', 'Wrap errors with %w and return typed errors; never panic in handlers', 'Build containers with multi-stage Dockerfiles'] },
  { id: 'dotnet', label: 'C# / .NET', category: 'backend', lang: 'C#', framework: 'ASP.NET Core',
    bestFor: ['Microsoft-ecosystem enterprise apps with strong tooling', 'High-performance APIs with ASP.NET Core', 'Azure-native: App Service, Functions, Cosmos DB'],
    example: { app: 'Stack Overflow', stack: ['C# / .NET', 'React', 'SQL Server', 'Azure'], highlight: 'C# / .NET' },
    why: 'Fast, typed and deeply integrated with Azure and enterprise identity.',
    rules: ['Enable nullable reference types; treat warnings as errors', 'Async all the way down; never .Result or .Wait()'] },
  { id: 'serverless', label: 'Serverless functions', category: 'backend', lang: 'TypeScript',
    bestFor: ['Bursty, event-driven workloads (APIs, webhooks, cron)', 'Pay-per-use billing instead of idle servers', 'No servers to manage (AWS Lambda, Vercel / Netlify Functions)'],
    example: { app: 'Stripe webhook handlers, cron jobs', stack: ['Node.js', 'AWS Lambda', 'DynamoDB'], highlight: 'Serverless functions' },
    why: 'Zero idle cost and no servers to patch, as long as work fits in short-lived invocations.',
    rules: ['Functions are stateless and idempotent; assume every event can be delivered twice', '! Use a pooled or HTTP-based database driver; never open a raw connection per invocation'] },
  { id: 'graphql', label: 'GraphQL', category: 'backend',
    bestFor: ['Client-driven queries: fetch exactly what the UI needs', 'Avoids over- and under-fetching compared with REST', 'A typed schema that doubles as living API docs'],
    example: { app: 'GitHub API v4, Shopify Storefront API', stack: ['GraphQL', 'Node.js', 'PostgreSQL'], highlight: 'GraphQL' },
    why: 'One typed schema for many clients, with the UI in control of the shape of data.',
    rules: ['Use DataLoader (or equivalent) for every relation resolver', 'Enforce query depth and complexity limits'] },

  // DATA
  { id: 'postgres', label: 'PostgreSQL', category: 'database',
    bestFor: ['Strong consistency for transactional systems', 'JSON, window functions and full-text search in one engine', 'Extensions: PostGIS, TimescaleDB, pgvector'],
    example: { app: 'Shopify, GitHub, Instagram', stack: ['Ruby on Rails', 'PostgreSQL', 'Redis'], highlight: 'PostgreSQL' },
    why: 'The right default database for most products: ACID, JSON, full-text search and extensions like pgvector.',
    rules: ['! Every schema change is a migration; never ALTER TABLE by hand in production', 'Index every foreign key and every column used in a frequent WHERE / ORDER BY', 'Use parameterized queries only; never build SQL with string concatenation'] },
  { id: 'mysql', label: 'MySQL', category: 'database',
    bestFor: ['Web apps with wide hosting support', 'Simple, battle-tested and widely understood', 'Read-heavy workloads'],
    example: { app: 'WordPress, early Facebook', stack: ['PHP', 'MySQL', 'Memcached'], highlight: 'MySQL' },
    why: 'Ubiquitous and well understood; every host and ORM supports it.',
    rules: ['Use InnoDB and utf8mb4 everywhere', 'Every schema change is a migration'] },
  { id: 'mongodb', label: 'MongoDB', category: 'database',
    bestFor: ['Schema-flexible document storage', 'Iterate without heavy migrations', 'Nested documents map naturally to JSON objects'],
    example: { app: 'Airbnb listings data', stack: ['React', 'Node.js', 'MongoDB', 'Redis'], highlight: 'MongoDB' },
    why: 'Documents that match your API shapes; flexible while the model is still changing.',
    rules: ['! Validate every document with a schema (Mongoose / zod / JSON Schema validators)', 'Design collections around query patterns; embed what is read together'] },
  { id: 'sqlite', label: 'SQLite', category: 'database',
    bestFor: ['Embedded database for local-first, mobile and desktop apps', 'Zero server setup: a single file is the database', 'Edge deployments (D1, Turso, LiteFS)'],
    example: { app: 'Obsidian, most mobile apps', stack: ['Electron', 'SQLite', 'Node.js'], highlight: 'SQLite' },
    why: 'The world’s most deployed database. Perfect for offline-capable clients and edge deployments.',
    rules: ['Enable WAL mode for concurrent reads', 'Wrap multi-statement writes in transactions'] },
  { id: 'redis', label: 'Redis', category: 'database',
    bestFor: ['Caching, sessions and rate limiting at microsecond latency', 'Queues (BullMQ, Sidekiq) and pub/sub', 'Leaderboards, counters and sorted sets'],
    example: { app: 'X / Twitter timelines', stack: ['Scala', 'Redis', 'MySQL'], highlight: 'Redis' },
    why: 'Cache hot queries, hold sessions, rate-limit APIs and back job queues; often a 10x p95 win on read-heavy paths.',
    rules: ['Every cache key has a TTL and a documented invalidation path', 'Redis is a cache or queue, never the only copy of important data'] },
  { id: 'elasticsearch', label: 'Elasticsearch / OpenSearch', category: 'database',
    bestFor: ['Full-text search with relevance scoring', 'Log aggregation and analytics', 'Faceted search, autocomplete and fuzzy matching'],
    example: { app: 'GitHub search, Wikipedia', stack: ['Ruby', 'Elasticsearch', 'PostgreSQL'], highlight: 'Elasticsearch / OpenSearch' },
    why: 'Full-text search with facets, fuzzy matching and analytics at scale.',
    rules: ['Define explicit index mappings; do not rely on dynamic mapping', 'The primary database is the source of truth; the index is rebuildable'] },
  { id: 'firebase', label: 'Firebase / Firestore', category: 'database',
    bestFor: ['Zero-ops backend: realtime sync, auth and hosting', 'Offline-first mobile apps', 'Generous free tier for MVPs'],
    example: { app: 'Duolingo (parts), many indie apps', stack: ['Firebase', 'React Native', 'Node.js'], highlight: 'Firebase / Firestore' },
    why: 'Realtime data, auth and hosting without running a server.',
    rules: ['! Security rules are code: review and test them like code', 'Model data for the queries you run; avoid unbounded collection reads'] },
  { id: 'supabase', label: 'Supabase', category: 'database',
    bestFor: ['Postgres + auth + storage + realtime in one managed platform', 'Row-level security for multi-tenant data', 'Instant REST and GraphQL APIs from your schema'],
    example: { app: 'Many funded startups and indie SaaS', stack: ['Supabase', 'Next.js', 'PostgreSQL'], highlight: 'Supabase' },
    why: 'Postgres, auth, storage and realtime in one managed platform: the fastest path from idea to production without giving up SQL.',
    rules: ['! Enable Row-Level Security on every table exposed to the client', '! The service-role key never leaves the server'] },
  { id: 'pgvector', label: 'pgvector', category: 'database',
    bestFor: ['Vector similarity search inside PostgreSQL', 'RAG without a separate vector database', 'Join embeddings with relational data and permissions'],
    example: { app: 'Supabase AI, many RAG apps', stack: ['PostgreSQL', 'pgvector', 'FastAPI'], highlight: 'pgvector' },
    why: 'Vector search inside Postgres: no second datastore to sync, and permissions apply to retrieval too. Comfortable up to a few million vectors.',
    rules: ['Store the embedding model name and dimension alongside each vector', 'Add an HNSW index before the table passes ~100K rows'] },
  { id: 'pinecone', label: 'Pinecone / Qdrant', category: 'database',
    bestFor: ['Dedicated vector search at large scale', 'Metadata filtering and hybrid search', 'Managed (Pinecone) or open-source (Qdrant)'],
    example: { app: 'Notion AI, Perplexity-style retrieval', stack: ['Python', 'Embeddings', 'Pinecone', 'FastAPI'], highlight: 'Pinecone / Qdrant' },
    why: 'A dedicated vector store once pgvector stops being enough (tens of millions of vectors or heavy filtering).',
    rules: ['Namespace vectors per tenant; never rely on client-side filtering for isolation'] },

  // CLOUD / INFRA
  { id: 'cloud-managed', label: 'AWS / Azure / GCP', category: 'cloud',
    bestFor: ['Managed scaling, backups and high availability', 'Managed services (RDS, Cloud Run, Lambda, Vertex)', 'Enterprise compliance: VPCs, IAM, audit trails'],
    example: { app: 'Stripe, Netflix', stack: ['Node.js', 'AWS', 'PostgreSQL', 'Redis'], highlight: 'AWS / Azure / GCP' },
    why: 'Managed databases, autoscaling and compliance controls when you outgrow a PaaS.',
    rules: ['All infrastructure is code (Terraform / CDK / Pulumi); no console-only changes', '! Secrets live in a secrets manager, never in env files committed to git'] },
  { id: 'docker', label: 'Docker (Compose)', category: 'cloud',
    bestFor: ['Reproducible environments from laptop to CI to production', 'Run the whole stack locally with one command', 'Portable across any host or cloud'],
    example: { app: 'Nearly every modern backend team', stack: ['Docker', 'Compose', 'PostgreSQL', 'Redis'], highlight: 'Docker (Compose)' },
    why: 'Reproducible environments from dev to prod; ends "works on my machine". Essential once a second person joins.',
    rules: ['Multi-stage builds; run as a non-root user', 'docker compose up must start the full local stack'] },
  { id: 'docker-k8s', label: 'Kubernetes', category: 'cloud',
    bestFor: ['Orchestrating many services with autoscaling and self-healing', 'Blue-green and canary deploys', 'Standard platform across clouds and on-prem'],
    example: { app: 'Spotify, Airbnb backends', stack: ['Docker', 'Kubernetes', 'PostgreSQL'], highlight: 'Kubernetes' },
    why: 'Orchestration, autoscaling and self-healing for many services. Worth it with a platform team, costly without one.',
    rules: ['Every workload sets resource requests/limits and readiness/liveness probes', 'Configuration via ConfigMaps/Secrets; images are immutable and tagged by commit'] },
  { id: 'vercel-netlify', label: 'Vercel / Netlify', category: 'cloud',
    bestFor: ['Zero-config CI/CD for frontends and edge functions', 'Preview URL for every pull request', 'Global CDN and edge caching'],
    example: { app: 'Vercel.com, many startup sites', stack: ['Next.js', 'Vercel', 'PostgreSQL'], highlight: 'Vercel / Netlify' },
    why: 'Git-push deploys with preview URLs per branch: infrastructure disappears from the critical path.',
    rules: ['Every pull request gets a preview deployment that is checked before merge'] },
  { id: 'cloudflare-workers', label: 'Cloudflare Workers', category: 'cloud', lang: 'TypeScript',
    bestFor: ['Edge compute in hundreds of locations', 'Near-zero cold starts with KV, D1, R2 and Durable Objects', 'Auth checks, geo-routing and personalization at the edge'],
    example: { app: 'Cloudflare dashboard, Discord (parts)', stack: ['Cloudflare Workers', 'D1', 'R2', 'KV'], highlight: 'Cloudflare Workers' },
    why: 'Edge compute with built-in storage (KV, D1, R2): fast everywhere, no servers or CDN config to manage.',
    rules: ['Workers use Web APIs only; no Node-only modules or long-running work', 'Bindings (KV, D1, R2) are declared in wrangler config, never hardcoded'] },

  // SERVICES
  { id: 'stripe', label: 'Stripe', category: 'services',
    bestFor: ['Payments, subscriptions and invoicing', 'Marketplaces with split payouts (Connect)', 'Keeps raw card data out of your systems (PCI scope)'],
    example: { app: 'Shopify, Lyft, most SaaS billing', stack: ['Stripe', 'Node.js', 'PostgreSQL'], highlight: 'Stripe' },
    why: 'Payments, subscriptions, fraud checks and Connect payouts solved; card data never touches your servers.',
    rules: ['! Never handle raw card numbers; tokenize client-side with Stripe Elements / Checkout', '! Verify webhook signatures and make every webhook handler idempotent', 'Send an idempotency key with every payment-creating API call'] },
  { id: 'auth-provider', label: 'Auth provider (Clerk / Auth0 / Supabase Auth)', category: 'services',
    bestFor: ['OAuth, MFA, SSO and RBAC without building them', 'Session management and token rotation handled', 'Enterprise SSO (SAML/OIDC) when deals need it'],
    example: { app: 'Most modern SaaS apps', stack: ['Clerk', 'Auth0', 'Supabase Auth', 'Keycloak'], highlight: 'Clerk' },
    why: 'Auth is a security minefield; a provider turns weeks of risky work into an afternoon.',
    rules: ['! Never implement password hashing, sessions or token signing by hand', 'Authorize on the server for every request; the client only hides UI'] },
  { id: 'object-storage', label: 'Object storage (S3 / R2)', category: 'services',
    bestFor: ['Images, video and documents of any size', 'Direct browser uploads with presigned URLs', 'Cheap, durable storage with a CDN in front'],
    example: { app: 'Dropbox, Instagram media', stack: ['S3', 'CloudFront', 'PostgreSQL'], highlight: 'S3' },
    why: 'Files belong in object storage with only the URL in your database.',
    rules: ['! Never store file blobs in the database; store keys/URLs only', 'Upload via presigned URLs; validate type and size server-side'] },
  { id: 'speech', label: 'Speech-to-text API', category: 'services',
    bestFor: ['Transcription and translation for voice features', 'Meeting notes, podcast indexing, voice input', 'Hosted APIs or self-hosted open models'],
    example: { app: 'Otter.ai, Fireflies.ai', stack: ['Python', 'Speech-to-text', 'FastAPI', 'PostgreSQL'], highlight: 'Speech-to-text' },
    why: 'Turns audio into text you can search, summarize and feed to an LLM.',
    rules: ['Process audio asynchronously in a job queue; never in the request thread'] },

  // PATTERNS
  { id: 'pat-local-first', label: 'Local-first / offline', category: 'patterns',
    bestFor: ['Apps that must work without internet (field, mobile, rural)', 'Instant UI: read/write locally, sync later', 'Full data ownership on user devices'],
    example: { app: 'Linear, Figma, Obsidian', stack: ['SQLite', 'OPFS', 'PowerSync', 'React'], highlight: 'SQLite' },
    why: 'Local reads and writes make the UI instant and resilient to bad networks.',
    rules: ['Define the conflict-resolution strategy (last-write-wins vs CRDT) before writing sync code'] },
  { id: 'pat-cdc', label: 'CDC / event sourcing', category: 'patterns',
    bestFor: ['Capture every data change as an immutable event stream', 'Replay history, audit trails and temporal queries', 'Decouple services via events'],
    example: { app: 'Banking ledgers', stack: ['Debezium', 'Kafka', 'PostgreSQL'], highlight: 'Debezium' },
    why: 'An immutable history of changes for audits, replays and downstream consumers.',
    rules: ['Events are immutable and versioned; never edit a published event schema in place'] },
  { id: 'pat-cqrs', label: 'CQRS (read/write split)', category: 'patterns',
    bestFor: ['Scale reads and writes independently', 'Denormalized read views over a normalized write model', 'Read-heavy dashboards with complex writes'],
    example: { app: 'Trading platforms, analytics dashboards', stack: ['Node.js', 'PostgreSQL', 'Redis', 'Elasticsearch'], highlight: 'Redis' },
    why: 'Keeps heavy analytics reads from starving transactional writes.',
    rules: ['Reporting queries run against replicas or read models, never the primary'] },
  { id: 'pat-master-replica', label: 'Primary + read replicas', category: 'patterns',
    bestFor: ['Scale reads horizontally', 'One write primary keeps consistency simple', 'Connection pooling with PgBouncer / ProxySQL'],
    example: { app: 'GitHub, Shopify', stack: ['PostgreSQL', 'PgBouncer', 'Read replicas'], highlight: 'PostgreSQL' },
    why: 'The cheapest big win for read-heavy apps before any re-architecture.',
    rules: ['Route read-your-own-writes paths to the primary; everything else may use replicas'] },
  { id: 'pat-job-queues', label: 'Job queues / workers', category: 'patterns',
    bestFor: ['Move emails, PDFs and ML inference off the request path', 'Retries with backoff and dead-letter queues', 'Scheduled and batch work'],
    example: { app: 'Resend, CI runners', stack: ['BullMQ', 'Redis', 'Node.js'], highlight: 'BullMQ' },
    why: 'Anything slow or flaky (email, uploads, third-party APIs, LLM batch work) belongs in a queue.',
    rules: ['Jobs are idempotent and retry with exponential backoff', 'No third-party API calls or email sends inside the request thread'] },
  { id: 'pat-realtime', label: 'Real-time sync', category: 'patterns',
    bestFor: ['Live collaboration, presence and instant updates', 'Push-based data over WebSockets', 'Conflict resolution for concurrent edits (CRDTs)'],
    example: { app: 'Figma, Notion, Slack', stack: ['Liveblocks', 'Supabase Realtime', 'Redis Pub/Sub'], highlight: 'Supabase Realtime' },
    why: 'Presence and live updates without hand-rolling stateful WebSocket servers.',
    rules: ['Use optimistic UI updates and reconcile with the server state'] },
  { id: 'pat-edge', label: 'Edge computing', category: 'patterns',
    bestFor: ['Sub-50ms responses globally', 'Auth checks, A/B tests, geo-routing at the CDN', 'Cloudflare Workers, Vercel Edge, Deno Deploy'],
    example: { app: 'Vercel middleware, Cloudflare apps', stack: ['Cloudflare Workers', 'Vercel Edge', 'Deno Deploy'], highlight: 'Cloudflare Workers' },
    why: 'Run latency-sensitive logic close to users; keep heavy work at the origin.',
    rules: ['Keep hot, small data at the edge; cold or relational data stays at the origin'] },
  { id: 'pat-auto-api', label: 'Auto-generated APIs', category: 'patterns',
    bestFor: ['REST / GraphQL straight from your schema', 'Skip boilerplate CRUD', 'Hasura, PostgREST, Supabase'],
    example: { app: 'Supabase and Hasura backends', stack: ['Hasura', 'PostgREST', 'PostgreSQL'], highlight: 'Hasura' },
    why: 'CRUD endpoints for free, so custom code only covers real business logic.',
    rules: ['Permissions are defined in the database/API layer and covered by tests'] },
  { id: 'pat-cdn-swr', label: 'CDN + stale-while-revalidate', category: 'patterns',
    bestFor: ['Serve cached content instantly, revalidate in the background', 'ISR, SWR headers, Cloudflare cache', 'Cuts origin load dramatically'],
    example: { app: 'E-commerce product pages', stack: ['Next.js ISR', 'Cloudflare', 'Vercel'], highlight: 'Next.js ISR' },
    why: 'Most pages can be slightly stale; caching them at the CDN is the cheapest scaling there is.',
    rules: ['Every public response sets explicit Cache-Control headers'] },
  { id: 'pat-durable', label: 'Durable workflows', category: 'patterns',
    bestFor: ['Long-running, multi-step processes that survive crashes', 'Automatic retries, timeouts and compensation', 'Order fulfilment, onboarding, ETL'],
    example: { app: 'Payment orchestration, order fulfilment', stack: ['Temporal', 'Inngest', 'Node.js'], highlight: 'Temporal' },
    why: 'Multi-step processes that must finish even when a server dies halfway.',
    rules: ['Workflow steps are deterministic; side effects live in activities'] },
  { id: 'pat-microservices', label: 'Microservices', category: 'patterns',
    bestFor: ['Independent deploy and scaling per service', 'Team autonomy: each team owns its service and data', 'gRPC internally, API gateway externally'],
    example: { app: 'Netflix, Uber', stack: ['Kubernetes', 'gRPC', 'API gateway'], highlight: 'Kubernetes' },
    why: 'Independent deploys for independent teams. Only worth it with many engineers.',
    rules: ['Services never share a database; communicate through APIs or events'] },
];

// ── AI model slots (resolved against the registry at runtime) ─────────────
// Descriptions describe the *tier*, not a specific version, so they stay true
// as the registry moves on. The chip shows the current model name/price/context.
export const MODEL_SLOTS = [
  { id: 'ai-anthropic-sonnet', vendor: 'anthropic', key: 'sonnet', label: 'Anthropic Sonnet',
    bestFor: ['Balanced quality and cost: the everyday premium pick', 'Strong coding, analysis and agentic tool use', 'Default model in many AI coding tools'] },
  { id: 'ai-anthropic-opus', vendor: 'anthropic', key: 'opus', label: 'Anthropic Opus',
    bestFor: ['Deep reasoning on complex, long-context work', 'Architecture reviews and hard debugging', 'When correctness matters more than cost'] },
  { id: 'ai-anthropic-fable', vendor: 'anthropic', key: 'fable', label: 'Anthropic Fable',
    bestFor: ['Anthropic’s highest-priced tier in the registry', 'Reserve for the hardest long-horizon tasks', 'Pair with a cheaper tier for routine calls'] },
  { id: 'ai-anthropic-haiku', vendor: 'anthropic', key: 'haiku', label: 'Anthropic Haiku',
    bestFor: ['Fast, low-cost classification, routing and extraction', 'High-volume pipelines and sub-agents', 'Latency-sensitive features'] },
  { id: 'ai-openai-sol', vendor: 'openai', key: 'sol', label: 'OpenAI Sol',
    bestFor: ['OpenAI’s balanced flagship tier', 'General reasoning with tool / function calling', 'Mature SDKs, batch and realtime APIs'] },
  { id: 'ai-openai-astra', vendor: 'openai', key: 'astra', label: 'OpenAI Astra',
    bestFor: ['OpenAI’s top-priced tier', 'Hard multi-step reasoning and research agents', 'Use sparingly behind a cheaper default'] },
  { id: 'ai-openai-luna', vendor: 'openai', key: 'luna', label: 'OpenAI Luna',
    bestFor: ['Very low cost per token', 'Summaries, tagging and chat at scale', 'Good first model for cost-sensitive features'] },
  { id: 'ai-google-pro', vendor: 'google', key: 'pro', label: 'Google Gemini Pro',
    bestFor: ['Multimodal input (text, image, video, audio) in one call', 'Long-context analysis', 'Google Cloud / Vertex AI integration'] },
  { id: 'ai-google-flash', vendor: 'google', key: 'flash', label: 'Google Gemini Flash',
    bestFor: ['High-volume RAG, chat and summarization', 'Low latency at a low price', 'Large context windows for bulk document work'] },
  { id: 'ai-x-ai-default', vendor: 'x-ai', key: 'default', label: 'xAI Grok',
    bestFor: ['General reasoning and chat', 'Large context window', 'Alternative frontier provider for redundancy'] },
  { id: 'ai-deepseek-pro', vendor: 'deepseek', key: 'pro', label: 'DeepSeek Pro',
    bestFor: ['Strong reasoning at a low price', 'Open-weights lineage: can be self-hosted', 'Cost-sensitive coding and analysis'] },
  { id: 'ai-qwen-coder', vendor: 'qwen', key: 'coder', label: 'Qwen Coder',
    bestFor: ['Open-weights coding model', 'Self-hosted code assistants', 'Low cost via hosted providers'] },
  { id: 'ai-meta-llama-maverick', vendor: 'meta-llama', key: 'maverick', label: 'Meta Llama',
    bestFor: ['Open weights: self-host for full data control', 'Fine-tuning and domain adaptation', 'Air-gapped and on-prem deployments (vLLM / Ollama)'] },
];

// ── AI coding tools = Cortex compile targets ─────────────────────────────
// Labels come from TARGETS[target].name at runtime; `fallback` is only used
// if the engine is unavailable.
export const TOOL_SLOTS = [
  { id: 'tool-claude', target: 'claude', fallback: 'Claude Code',
    bestFor: ['Terminal-first agent that edits, runs and tests code', 'Reads CLAUDE.md plus scoped rules and Agent Skills', 'Strong at multi-file refactors and long tasks'] },
  { id: 'tool-cursor', target: 'cursor', fallback: 'Cursor',
    bestFor: ['AI-first editor with project-wide context', 'Multi-file edits from one prompt', 'Scoped .cursor/rules/*.mdc per path'] },
  { id: 'tool-copilot', target: 'copilot', fallback: 'GitHub Copilot',
    bestFor: ['Inline completions and chat in VS Code / JetBrains', 'Coding agent that opens pull requests', 'Team-friendly: tied to GitHub PRs and reviews'] },
  { id: 'tool-codex', target: 'codex', fallback: 'AGENTS.md', prefix: 'Codex',
    bestFor: ['OpenAI Codex CLI and cloud agent', 'AGENTS.md is also read by many other agents', 'One shared file for every AGENTS.md-aware tool'] },
  { id: 'tool-gemini', target: 'gemini', fallback: 'Gemini CLI',
    bestFor: ['Google’s open-source terminal agent', 'Large context windows for whole-repo questions', 'Reads GEMINI.md'] },
  { id: 'tool-windsurf', target: 'windsurf', fallback: 'Windsurf / Devin Desktop',
    bestFor: ['Agentic editor with multi-step flows', 'Deep codebase indexing', 'Scoped rules in .windsurf/rules'] },
  { id: 'tool-kiro', target: 'kiro', fallback: 'Kiro',
    bestFor: ['Spec-driven development: requirements → design → tasks', 'Steering files keep the agent on-convention', 'Good fit for AWS-centric teams'] },
  { id: 'tool-antigravity', target: 'antigravity', fallback: 'Antigravity',
    bestFor: ['Agent-first IDE that runs several agents in parallel', 'Browser-in-the-loop verification', 'Reads .agents/rules'] },
];

/** Default compile targets when no coding tool is picked. */
export const DEFAULT_TARGETS = ['claude', 'codex', 'cursor', 'copilot'];

// ── Build matrix ───────────────────────────────────────────────────────────
export const MATRIX = [
  { name: 'MVP / SaaS app', stack: ['react', 'node-express', 'postgres', 'vercel-netlify'], complexity: 'Medium', example: 'Notion, Linear, Loom (early)' },
  { name: 'AI chat application', stack: ['react', 'python-fastapi', 'postgres', 'ai-anthropic-sonnet'], complexity: 'Medium', example: 'Claude.ai, Perplexity, Poe' },
  { name: 'E-commerce platform', stack: ['react', 'ruby-rails', 'postgres', 'redis', 'elasticsearch', 'stripe'], complexity: 'High', example: 'Shopify, Etsy' },
  { name: 'Marketing / landing page', stack: ['html-css', 'vercel-netlify'], complexity: 'Low', example: 'Most startup product sites' },
  { name: 'Full-stack TypeScript app', stack: ['nextjs', 'typescript', 'postgres', 'vercel-netlify'], complexity: 'Medium', example: 'Vercel, Linear, Retool' },
  { name: 'ML API + data backend', stack: ['python-fastapi', 'postgres', 'redis', 'cloud-managed'], complexity: 'Medium', example: 'Instagram ML, Duolingo' },
  { name: 'Voice AI app', stack: ['python-fastapi', 'speech', 'ai-openai-sol', 'postgres', 'pat-job-queues'], complexity: 'Medium', example: 'Otter.ai, Fireflies.ai' },
  { name: 'Self-hosted AI platform', stack: ['node-express', 'ai-meta-llama-maverick', 'postgres', 'docker-k8s'], complexity: 'High', example: 'On-prem LLM portals, PrivateGPT' },
  { name: 'Mobile app with AI', stack: ['react-native', 'python-fastapi', 'ai-google-flash', 'sqlite'], complexity: 'Medium', example: 'Duolingo-style AI features' },
  { name: 'Enterprise web app', stack: ['angular', 'java-spring', 'postgres', 'docker-k8s', 'cloud-managed'], complexity: 'Very high', example: 'Banking portals, SAP-style apps' },
  { name: 'Search & analytics pipeline', stack: ['python-fastapi', 'elasticsearch', 'pgvector', 'postgres', 'cloud-managed'], complexity: 'High', example: 'GitHub search, Datadog' },
  { name: 'Real-time collaboration tool', stack: ['react', 'node-express', 'redis', 'postgres', 'pat-realtime'], complexity: 'High', example: 'Figma, Miro, Linear' },
  { name: 'Serverless API / webhooks', stack: ['serverless', 'postgres', 'cloud-managed'], complexity: 'Low–Med', example: 'Stripe webhooks, integrations' },
  { name: 'Zero-ops RAG app', stack: ['nextjs', 'supabase', 'pgvector', 'ai-anthropic-sonnet', 'vercel-netlify'], complexity: 'Low–Med', example: 'Docs Q&A, Notion AI-style search' },
  { name: 'Edge-first web app', stack: ['react', 'cloudflare-workers', 'sqlite', 'pat-edge'], complexity: 'Medium', example: 'Global low-latency apps' },
  { name: 'Marketplace', stack: ['nextjs', 'node-express', 'postgres', 'stripe', 'auth-provider', 'object-storage'], complexity: 'High', example: 'Airbnb, Etsy, Upwork' },
];

// ── Guide Me (4 questions → preset) ────────────────────────────────────────
export const QA_STEPS = [
  { id: 'type', short: 'Building', question: 'What are you building?', hint: 'Pick the closest match; you can refine the stack afterwards.',
    options: [
      { value: 'web', label: 'Web app / SaaS' }, { value: 'api', label: 'API / backend service' },
      { value: 'ai', label: 'AI / LLM product' }, { value: 'mobile', label: 'Mobile app' },
      { value: 'data', label: 'Data / ML pipeline' }, { value: 'landing', label: 'Landing page' },
    ] },
  { id: 'ai', short: 'AI', question: 'How central is AI to your product?', hint: 'This decides whether (and which tier of) model belongs in the stack.',
    options: [
      { value: 'none', label: 'No AI needed' }, { value: 'light', label: 'Light AI (summaries, search)' },
      { value: 'core', label: 'Core product (chat, agents)' }, { value: 'self', label: 'Self-hosted / private AI' },
    ] },
  { id: 'team', short: 'Team', question: 'Who is building it?', hint: 'Team size shapes framework choice and how much complexity you can carry.',
    options: [
      { value: 'solo', label: 'Solo / indie' }, { value: 'small', label: 'Small team (2–5)' }, { value: 'enterprise', label: 'Larger team or enterprise (6+)' },
    ] },
  { id: 'speed', short: 'Timeline', question: 'How fast do you need to ship?', hint: 'Speed versus long-term scale is the core trade-off.',
    options: [
      { value: 'weekend', label: 'This weekend' }, { value: 'weeks', label: '1–4 weeks' }, { value: 'months', label: '3+ months' },
    ] },
];

const AI_RULES_BASE = ['Wrap every LLM call in one service module so models can be swapped in one place', 'Stream long responses to the UI', '! Never send secrets or unnecessary personal data in prompts', 'Log model id, latency and token usage for every call'];

export const PRESETS = {
  landing: { name: 'Marketing / landing page', headline: 'Zero infrastructure. Live in minutes.',
    why: 'HTML/CSS and a little JavaScript is the simplest path to a live site. No build tooling, no framework overhead; Vercel or Netlify gives you deploys on git push.',
    examples: 'Apple.com marketing pages, most startup landing pages',
    chips: ['html-css', 'vercel-netlify'], rules: [] },
  'lean-mvp': { name: 'Lean MVP / SaaS', headline: 'Ship fast, scale later.',
    why: 'React and Node.js share one TypeScript mental model across the stack. PostgreSQL is a rock-solid relational foundation, and Vercel removes infrastructure from the critical path.',
    examples: 'Notion, Linear, Loom (early versions)',
    chips: ['react', 'typescript', 'node-express', 'postgres', 'vercel-netlify'], rules: ['One preview deployment per pull request'] },
  'ai-mvp': { name: 'AI-powered product (MVP)', headline: 'Conversation-first, deployed in days.',
    why: 'FastAPI plus {{anthropic.sonnet}} is a fast path to a working LLM product: async by default, typed Pydantic models, generated API docs, and a model tier that balances quality and cost for a first launch.',
    examples: 'Perplexity-style answer engines, AI writing assistants',
    chips: ['react', 'python-fastapi', 'postgres', 'ai-anthropic-sonnet', 'vercel-netlify'],
    rules: [...AI_RULES_BASE, 'Retry LLM calls with exponential backoff and a timeout', 'Rate-limit every endpoint that calls a model'] },
  'ai-production': { name: 'Production AI application', headline: 'Built to handle real load.',
    why: 'Redis rate-limits and caches expensive model calls, pgvector keeps retrieval next to your data, and managed cloud gives autoscaling and SLAs. Route routine calls to {{anthropic.haiku}} and hard ones to {{anthropic.sonnet}} to control cost.',
    examples: 'AI assistants and copilots at scale',
    chips: ['react', 'python-fastapi', 'postgres', 'pgvector', 'redis', 'ai-anthropic-sonnet', 'ai-anthropic-haiku', 'cloud-managed'],
    rules: [...AI_RULES_BASE, 'Cache deterministic LLM responses in Redis with a TTL', 'Track a token budget per user and per plan', 'Alert when p95 model latency exceeds 5s'] },
  'self-hosted-ai': { name: 'Self-hosted AI platform', headline: 'Your data never leaves your infrastructure.',
    why: 'Open-weights models such as {{meta-llama.maverick}} served with vLLM or Ollama keep inference on hardware you control. Kubernetes scales the serving layer; nothing leaves your network.',
    examples: 'Enterprise LLM portals, air-gapped government tools',
    chips: ['node-express', 'ai-meta-llama-maverick', 'postgres', 'docker-k8s'],
    rules: ['Serve models with vLLM or Ollama behind an internal API', 'Set GPU resource limits on inference pods', 'Log every inference call for audit', '! No prompt or completion may be sent to an external API'] },
  enterprise: { name: 'Enterprise web application', headline: 'Built for long-term maintainability.',
    why: 'Angular and Spring Boot are proven with large teams: strong typing from browser to database, dependency injection everywhere, and a testing story risk teams accept.',
    examples: 'Banking portals, internal enterprise platforms',
    chips: ['angular', 'java-spring', 'postgres', 'docker-k8s', 'cloud-managed', 'auth-provider'], rules: [] },
  'api-microservice': { name: 'High-performance API / service', headline: 'Maximum throughput, minimal overhead.',
    why: 'Go compiles to a single binary, handles tens of thousands of concurrent requests and uses a fraction of the memory of Node or Python.',
    examples: 'Uber services, Docker, Cloudflare internals',
    chips: ['go', 'postgres', 'redis', 'docker'], rules: ['Use Redis pipelines for batched operations'] },
  'data-pipeline': { name: 'Data / ML pipeline', headline: 'From raw data to insight, at scale.',
    why: 'FastAPI serves models behind typed async endpoints, Elasticsearch handles search and analytics, Redis caches expensive computations. {{google.flash}} is a cost-effective choice for bulk LLM processing.',
    examples: 'Duolingo ML platform, log and analytics pipelines',
    chips: ['python-fastapi', 'postgres', 'elasticsearch', 'redis', 'cloud-managed', 'pat-job-queues', 'ai-google-flash'],
    rules: ['Log model version and latency for every prediction', 'Batch LLM work through the queue, never in request handlers'] },
  'mobile-ai': { name: 'Mobile app with AI features', headline: 'Fast on the device, smart in the cloud.',
    why: 'React Native (Expo) ships iOS and Android from one codebase, SQLite keeps the app usable offline, and a FastAPI backend calls {{google.flash}} for low-latency, low-cost AI features. Use the platform’s on-device models where they exist, and fall back to the cloud.',
    examples: 'Duolingo, language and note-taking apps',
    chips: ['react-native', 'python-fastapi', 'sqlite', 'ai-google-flash'],
    rules: ['Call models from the backend only; never ship API keys in the app bundle', 'Handle offline / airplane mode on every screen'] },
  'web-with-ai': { name: 'Web app with AI features', headline: 'Your app, with AI where it helps.',
    why: 'Add {{anthropic.sonnet}} behind a service in your Node backend for summaries, classification and smart suggestions. Minimal architecture change, visible user value.',
    examples: 'Linear AI, Notion AI, in-app copilots',
    chips: ['react', 'typescript', 'node-express', 'postgres', 'ai-anthropic-sonnet', 'vercel-netlify'],
    rules: [...AI_RULES_BASE, 'Show sources or confidence where AI output informs a decision', 'Collect thumbs-up/down feedback on AI output'] },
};

export function getPresetKey(a) {
  if (a.type === 'landing') return 'landing';
  if (a.type === 'mobile') return 'mobile-ai';
  if (a.type === 'data') return 'data-pipeline';
  if (a.ai === 'self') return 'self-hosted-ai';
  if (a.type === 'api') return 'api-microservice';
  // What you build outranks who builds it: an AI-core product stays an AI stack even for large teams.
  if (a.type === 'ai' || a.ai === 'core') return a.speed === 'months' || a.team === 'enterprise' ? 'ai-production' : 'ai-mvp';
  if (a.team === 'enterprise') return a.ai === 'light' ? 'web-with-ai' : 'enterprise';
  if (a.ai === 'light') return 'web-with-ai';
  return 'lean-mvp';
}

// ── Stack tips ─────────────────────────────────────────────────────────────
export const GUIDE_SECTIONS = [
  { heading: 'When to pick which stack', items: [
    { label: 'MVP / startup', body: 'React or Next.js + Node.js + PostgreSQL (or Supabase / Firebase for zero-ops). Ship in days, not months.' },
    { label: 'Enterprise / long-lived system', body: 'Angular or React + Java/Spring or C#/.NET + PostgreSQL. Optimize for maintainability over speed.' },
    { label: 'High-performance / low-latency', body: 'Go or Node.js + Redis + PostgreSQL. Measure p99 before adding infrastructure.' },
    { label: 'Data-intensive / ML-heavy', body: 'Python (FastAPI/Django) + PostgreSQL + pgvector or a dedicated vector store for RAG.' },
  ] },
  { heading: 'When to pick which model tier', items: [
    { label: 'Maximum capability, agent-heavy', body: '{{anthropic.opus}} or {{openai.astra}}. Use when correctness matters more than cost.' },
    { label: 'Everyday production default', body: '{{anthropic.sonnet}}, {{openai.sol}} or {{google.pro}}: strong quality at a sustainable price.' },
    { label: 'High-volume, cost-sensitive', body: '{{anthropic.haiku}}, {{google.flash}} or {{openai.luna}} for chat, RAG, routing and classification.' },
    { label: 'Private / self-hosted', body: 'Open-weights models such as {{meta-llama.maverick}} or {{qwen.coder}} on vLLM or Ollama. No data leaves your network.' },
  ] },
  { heading: 'When to pick which coding tool', items: [
    { label: 'Terminal-first, long autonomous tasks', body: 'Claude Code, Codex CLI or Gemini CLI.' },
    { label: 'Editor-centric, multi-file edits', body: 'Cursor, Windsurf or Antigravity.' },
    { label: 'Team standardized on GitHub', body: 'GitHub Copilot, including its PR coding agent.' },
    { label: 'Mixed tools across the team', body: 'All of them. Write rules once in .cortex/ and compile to every tool, so nobody’s agent drifts.' },
  ] },
];

export function stackTips(categories, count) {
  const tips = [];
  const has = c => categories.has(c);
  if (has('frontend') && has('backend') && has('database'))
    tips.push({ title: 'Full-stack foundation', body: 'Frontend, backend and data are covered. Add hosting/infra and monitoring before launch.' });
  if (has('ai'))
    tips.push({ title: 'AI in the stack', body: 'Add a vector store (pgvector) if you need retrieval, and Redis for rate-limiting and caching model calls. Put every model call behind one service so you can switch tiers.' });
  if (has('cloud'))
    tips.push({ title: 'Production infrastructure', body: 'Plan environment parity (dev → staging → prod) and keep secrets in a managed secrets store.' });
  if (has('backend') && !has('frontend'))
    tips.push({ title: 'API-first', body: 'No frontend selected: great for services and headless APIs. Publish an OpenAPI spec from day one.' });
  if (has('frontend') && !has('backend'))
    tips.push({ title: 'Frontend-heavy', body: 'No backend selected: serverless functions or a BaaS (Supabase, Firebase) avoid standing up a server.' });
  if (has('tools'))
    tips.push({ title: 'AI-assisted development', body: 'Your coding tools each read a different instruction file. The config below compiles one rule set into all of them.' });
  if (count >= 6)
    tips.push({ title: 'Complex stack: document early', body: `You picked ${count} pieces. Write short Architecture Decision Records so the team (and its agents) know why each one exists.` });
  return tips;
}

// ── Architect My Project ───────────────────────────────────────────────────
export const SIMILAR_PRODUCTS = {
  saas: { ex: 'Notion, Linear, Intercom, Figma, Loom', note: 'Most funded SaaS products ship React + Node/Python + Postgres.' },
  marketplace: { ex: 'Airbnb, Etsy, Upwork, TaskRabbit', note: 'Airbnb ran on a Rails monolith for years before splitting it up.' },
  'internal-tool': { ex: 'Grafana, Retool, Metabase', note: 'Internal tools need reliability and fast iteration more than scale.' },
  'ai-product': { ex: 'Perplexity, Cursor, GitHub Copilot', note: 'AI products live or die by latency and grounding: streaming and retrieval are table stakes.' },
  'api-service': { ex: 'Stripe, Twilio, Plaid', note: 'API-first companies obsess over p99 latency, versioning and uptime from day one.' },
  mobile: { ex: 'Instagram, Duolingo, Strava', note: 'Instagram ran Python/Django to a billion users. Execution speed matters more than the stack.' },
  'data-platform': { ex: 'Segment, Mixpanel, Amplitude', note: 'Data platforms split OLTP (user actions) from OLAP (analytics). Doing both in one database hurts.' },
};

export const FAILURE_PATTERNS = {
  'n1-queries': { title: 'N+1 queries', text: 'Fetching related data in a loop kills most apps around 1K users. Use eager loading (Prisma include, Django select_related, DataLoader) from day one.' },
  'no-indexes': { title: 'Missing indexes', text: 'A 500K-row table with no index on a WHERE column means full table scans. Add indexes as you add queries, and index every foreign key.' },
  'no-cache': { title: 'No caching layer', text: 'Hitting the database for every request does not scale. Add Redis for sessions, rate limits and hot-path queries.' },
  'no-queue': { title: 'Synchronous everything', text: 'Sending email, resizing images or calling third-party APIs in the request thread blocks users. Use a job queue (BullMQ, pg-boss) from week one.' },
  'no-cdn': { title: 'No CDN', text: 'Serving images and JS from your origin collapses under traffic. Put a CDN in front on day one.' },
  'microservices-early': { title: 'Microservices too early', text: 'Netflix, Airbnb and Uber all started as monoliths. Distributed systems add latency, operational load and painful debugging. Ship a modular monolith first.' },
  'no-connection-pool': { title: 'No connection pooling', text: 'Each serverless invocation opening its own Postgres connection exhausts the database (~100 connections). Use PgBouncer, Supavisor or a serverless driver (Neon).' },
  'mongo-schema': { title: 'Schema-less chaos', text: '"Schema-less" becomes "schema nightmare" at scale. Validate documents (zod, Mongoose, JSON Schema) from the start.' },
  'no-monitoring': { title: 'Flying blind', text: 'Most startups learn about outages from users. Add error tracking, uptime checks and slow-query logs before launch.' },
  'auth-diy': { title: 'Rolling your own auth', text: 'Password hashing, sessions and token handling are a security minefield. Use Clerk, Auth0 or Supabase Auth.' },
  'no-rls': { title: 'No tenant isolation', text: 'Multi-tenant SaaS without enforced data isolation leaks customer data. Use Row-Level Security or enforced tenant scoping, and test it before launch.' },
  'blob-in-db': { title: 'Files in the database', text: 'Blobs bloat the database, slow backups and wreck performance. Use object storage (S3 / R2) and store only the key.' },
  'spa-seo': { title: 'SPA + SEO mismatch', text: 'A client-rendered SPA is close to invisible to search engines. If SEO matters, use SSR/SSG (Next.js, SvelteKit).' },
  'no-migrations': { title: 'No schema migrations', text: 'Hand-run ALTER TABLE in production is how teams lose data. Use Prisma Migrate, Flyway or Alembic from the first commit.' },
  'mobile-offline': { title: 'Online-only mobile app', text: 'Assume intermittent connectivity from day one; offline support is far harder to retrofit. Cache locally (SQLite) and sync in the background.' },
};

export const ARCH_STEPS = [
  { id: 'project-type', short: 'Product', question: 'What kind of product are you building?', hint: 'Think about what it looks similar to.', multi: false,
    options: [
      { value: 'saas', label: 'SaaS web app', sub: 'like Notion, Linear, Figma' },
      { value: 'marketplace', label: 'Marketplace', sub: 'like Airbnb, Etsy, Upwork' },
      { value: 'internal-tool', label: 'Internal tool / dashboard', sub: 'like Retool, Grafana' },
      { value: 'ai-product', label: 'AI product', sub: 'like Perplexity, Cursor' },
      { value: 'api-service', label: 'API / developer platform', sub: 'like Stripe, Twilio' },
      { value: 'mobile', label: 'Mobile app', sub: 'like Instagram, Duolingo' },
      { value: 'data-platform', label: 'Data / analytics platform', sub: 'like Segment, Mixpanel' },
    ] },
  { id: 'core-workflow', short: 'Core action', question: 'What is the core thing users do in your app?', hint: 'The primary action determines your data model and query patterns.', multi: false,
    options: [
      { value: 'crud', label: 'Create and manage records', sub: 'forms, lists, tables' },
      { value: 'collab', label: 'Collaborate in real time', sub: 'edit together, presence' },
      { value: 'transactions', label: 'Buy, sell or transfer', sub: 'payments, orders, bookings' },
      { value: 'content', label: 'Consume content', sub: 'feeds, articles, media' },
      { value: 'search-discovery', label: 'Search and discover', sub: 'items, people, knowledge' },
      { value: 'ai-chat', label: 'AI-assisted work', sub: 'chat, generate, summarize' },
      { value: 'analytics-view', label: 'View dashboards and metrics', sub: 'reports, charts' },
    ] },
  { id: 'scale', short: 'Scale', question: 'What scale are you targeting in the next 12 months?', hint: 'Be honest: over-engineering for scale kills more startups than under-engineering.', multi: false,
    options: [
      { value: 'tiny', label: 'Under 1K users', sub: 'MVP, internal tool or early beta' },
      { value: 'small', label: '1K – 50K users', sub: 'early product-market fit' },
      { value: 'medium', label: '50K – 500K users', sub: 'growth stage, paying customers' },
      { value: 'large', label: '500K+ users', sub: 'already at scale' },
    ] },
  { id: 'team', short: 'Team', question: 'How big is your team, and what is your timeline?', hint: 'A solo founder shipping in two weeks needs a different stack than a 10-person team with six months.', multi: false,
    options: [
      { value: 'solo-fast', label: 'Solo or 2 people', sub: 'ship in 2–4 weeks' },
      { value: 'small-3mo', label: '2–5 people', sub: 'ship in 1–3 months' },
      { value: 'team-6mo', label: '5–15 people', sub: '3–6 months to launch' },
      { value: 'team-long', label: '15+ people', sub: 'building for 6+ months' },
    ] },
  { id: 'data-patterns', short: 'Data needs', question: 'Which data and feature requirements apply?', hint: 'Select all that apply. These drive architecture more than anything else.', multi: true,
    options: [
      { value: 'realtime', label: 'Real-time', sub: 'live cursors, notifications, presence' },
      { value: 'offline', label: 'Offline-first', sub: 'works without internet, syncs later' },
      { value: 'read-heavy', label: 'Read-heavy', sub: 'dashboards, feeds, 10x more reads' },
      { value: 'write-heavy', label: 'Write-heavy', sub: 'event streams, logging, IoT' },
      { value: 'fulltext', label: 'Full-text or faceted search' },
      { value: 'vector', label: 'AI / vector search', sub: 'embeddings, RAG, semantic' },
      { value: 'timeseries', label: 'Time-series / metrics' },
      { value: 'largefiles', label: 'Large file uploads', sub: 'images, video, documents' },
      { value: 'multitenant', label: 'Multi-tenant', sub: 'isolated data per customer' },
      { value: 'payments', label: 'Payments or financial transactions' },
      { value: 'none', label: 'None of these', exclusive: true },
    ] },
  { id: 'auth-needs', short: 'Auth', question: 'What authentication does your product need?', hint: 'Auth is where many startups lose weeks they could spend on the product.', multi: false,
    options: [
      { value: 'none', label: 'None / public access' },
      { value: 'basic', label: 'Email + password' },
      { value: 'social', label: 'Social sign-in', sub: 'Google, GitHub, Apple' },
      { value: 'enterprise', label: 'Enterprise SSO / SAML', sub: 'B2B SaaS' },
      { value: 'mfa', label: 'MFA + advanced security', sub: 'fintech, healthcare' },
    ] },
  { id: 'infra', short: 'Infra', question: 'What are your infrastructure preferences?', hint: 'Each choice trades cost, complexity and speed to launch.', multi: false,
    options: [
      { value: 'any-cloud', label: 'No preference', sub: 'recommend the best fit' },
      { value: 'serverless', label: 'Serverless / managed', sub: 'minimize ops' },
      { value: 'containers', label: 'Containers / VMs', sub: 'full control, portable' },
      { value: 'on-prem', label: 'On-premises / self-hosted', sub: 'data sovereignty' },
      { value: 'edge', label: 'Edge-first', sub: 'low latency globally' },
    ] },
  { id: 'team-skills', short: 'Skills', question: 'What does your team already know?', hint: 'The best stack is the one you can execute quickly. Select all that apply.', multi: true,
    options: [
      { value: 'js-ts', label: 'JavaScript / TypeScript' }, { value: 'python', label: 'Python' },
      { value: 'java-csharp', label: 'Java / C# / .NET' }, { value: 'go-rust', label: 'Go / Rust' },
      { value: 'react', label: 'React / Next.js' }, { value: 'devops', label: 'Docker / Kubernetes / Terraform' },
      { value: 'ml-ai', label: 'ML / AI / LLM APIs' }, { value: 'sql', label: 'SQL / relational databases' },
    ] },
  { id: 'compliance', short: 'Compliance', question: 'Any regulatory or compliance requirements?', hint: 'These constrain providers and can rule out whole architectures.', multi: true,
    options: [
      { value: 'none', label: 'None yet', sub: 'move fast, revisit later', exclusive: true },
      { value: 'gdpr', label: 'GDPR', sub: 'EU personal data' },
      { value: 'hipaa', label: 'HIPAA', sub: 'US health data' },
      { value: 'soc2', label: 'SOC 2', sub: 'B2B enterprise requirement' },
      { value: 'pci', label: 'PCI-DSS', sub: 'card payments' },
      { value: 'airgapped', label: 'Air-gapped', sub: 'no external network access' },
    ] },
];

/** Toggle a multi-select value, honouring options marked `exclusive` (e.g. "None"). */
export function toggleMulti(step, current, value) {
  const list = Array.isArray(current) ? [...current] : [];
  const opt = step.options.find(o => o.value === value);
  if (list.includes(value)) return list.filter(v => v !== value);
  if (opt?.exclusive) return [value];
  const exclusive = new Set(step.options.filter(o => o.exclusive).map(o => o.value));
  return [...list.filter(v => !exclusive.has(v)), value];
}

const inc = (a, id, v) => (a[id] || []).includes(v);
const big = a => ['medium', 'large'].includes(a.scale);

export const INSIGHT_RULES = [
  // Compliance: hardest constraints first
  { id: 'hipaa-llm', type: 'warning', test: a => inc(a, 'compliance', 'hipaa'), text: 'HIPAA: hosted model APIs may only receive PHI under a signed Business Associate Agreement with that vendor. Otherwise use a self-hosted open-weights model (e.g. {{meta-llama.maverick}} on vLLM).' },
  { id: 'hipaa-storage', type: 'warning', test: a => inc(a, 'compliance', 'hipaa'), text: 'HIPAA requires encryption at rest and in transit, an audit log for every PHI access, and strict access controls. Plan 2–4 extra weeks of compliance work.' },
  { id: 'gdpr-residency', type: 'warning', test: a => inc(a, 'compliance', 'gdpr'), text: 'GDPR: keep EU personal data in EU regions, sign DPAs with every processor (including model APIs), and build right-to-erasure into the data layer.' },
  { id: 'airgapped', type: 'warning', test: a => inc(a, 'compliance', 'airgapped'), text: 'Air-gapped: zero external API calls. Self-host everything: open-weights models, Postgres, MinIO for storage, Keycloak for auth. Budget roughly 3x normal infrastructure effort.' },
  { id: 'soc2-logging', type: 'warning', test: a => inc(a, 'compliance', 'soc2'), text: 'SOC 2: structured audit logging (who accessed what, when), role-based access, change management and continuous monitoring. Start in month one, not month twelve.' },
  { id: 'pci-scope', type: 'warning', test: a => inc(a, 'compliance', 'pci'), text: 'PCI-DSS: never touch raw card data. Tokenize client-side with Stripe Elements/Checkout to stay in the lightest compliance scope.' },
  // Auth
  { id: 'auth-diy', type: 'warning', test: a => a['auth-needs'] && a['auth-needs'] !== 'none', text: 'Auth: rolling your own (hashing, sessions, tokens) takes weeks and is easy to get wrong. Use Clerk, Auth0 or Supabase Auth.' },
  { id: 'auth-enterprise', type: 'warning', test: a => a['auth-needs'] === 'enterprise', text: 'Enterprise SSO: SAML integration alone can take weeks. WorkOS or Auth0 handle Okta, Entra ID and Google Workspace, and SSO is often a deal blocker.' },
  // Data patterns
  { id: 'n1-warning', type: 'warning', test: a => ['crud', 'collab', 'transactions'].includes(a['core-workflow']), text: 'N+1 queries are the most common database killer for this kind of app. Use eager loading or DataLoader from day one.' },
  { id: 'no-index-warn', type: 'warning', test: big, text: 'At this scale, unindexed WHERE columns and foreign keys become incidents. Profile slow queries before launch.' },
  { id: 'offline-pattern', type: 'pattern', test: a => inc(a, 'data-patterns', 'offline'), text: 'Offline-first: local-first architecture with SQLite (OPFS in the browser) and PowerSync or ElectricSQL for sync. Decide last-write-wins vs CRDT before writing code.' },
  { id: 'realtime-pattern', type: 'pattern', test: a => inc(a, 'data-patterns', 'realtime'), text: 'Real-time: WebSockets are stateful and complicate horizontal scaling. Supabase Realtime, Ably or Liveblocks handle connections, presence and broadcast for you.' },
  { id: 'read-heavy-scale', type: 'tip', test: a => inc(a, 'data-patterns', 'read-heavy') && big(a), text: 'Read-heavy at scale: Redis for hot queries plus Postgres read replicas usually buys a 10x improvement before any hardware change.' },
  { id: 'write-heavy', type: 'pattern', test: a => inc(a, 'data-patterns', 'write-heavy'), text: 'Write-heavy: keep synchronous writes out of request handlers. Use a queue (BullMQ, pg-boss) and send high-frequency events to streams or a time-series store.' },
  { id: 'fulltext', type: 'tool', test: a => inc(a, 'data-patterns', 'fulltext'), text: 'Full-text search: Postgres tsvector is fine under ~1M rows. Beyond that, Typesense, Meilisearch or Elasticsearch/OpenSearch.' },
  { id: 'vector-db', type: 'tool', test: a => inc(a, 'data-patterns', 'vector'), text: 'Vector / RAG: pgvector handles a few million vectors inside Postgres. Plan the chunking and embedding pipeline before the chat UI.' },
  { id: 'timeseries', type: 'tool', test: a => inc(a, 'data-patterns', 'timeseries'), text: 'Time-series: plain Postgres tables are the wrong model for metrics. Use TimescaleDB (a Postgres extension) or a dedicated time-series database.' },
  { id: 'largefiles', type: 'warning', test: a => inc(a, 'data-patterns', 'largefiles'), text: 'Large files: never store blobs in the database. Use S3 / R2 with presigned uploads and keep only the key in Postgres.' },
  { id: 'multitenant', type: 'warning', test: a => inc(a, 'data-patterns', 'multitenant'), text: 'Multi-tenancy is the #1 B2B data-leak vector. Enforce isolation with Postgres Row-Level Security or mandatory tenant scoping, and test it before launch.' },
  { id: 'payments-stripe', type: 'tip', test: a => inc(a, 'data-patterns', 'payments'), text: 'Payments: use Stripe. Add idempotency keys to every payment call and test webhooks with the Stripe CLI before going live.' },
  // Infra
  { id: 'serverless-pool', type: 'warning', test: a => a.infra === 'serverless', text: 'Serverless + Postgres: every invocation can open a new connection and exhaust the database. Use a pooler (PgBouncer, Supavisor) or a serverless driver.' },
  { id: 'edge-limits', type: 'warning', test: a => a.infra === 'edge', text: 'Edge functions: no long-running work and no Node-only modules. Use D1/KV at the edge, or a remote Postgres through a pooler.' },
  { id: 'onprem-k8s', type: 'tip', test: a => a.infra === 'on-prem', text: 'On-prem: Kubernetes needs dedicated ops people. For small teams, Docker Compose on one strong VM handles most workloads up to ~50K users.' },
  // Team & scale
  { id: 'solo-speed', type: 'tip', test: a => a.team === 'solo-fast', text: 'Small team, short timeline: use the stack you already know and boring technology. Optimize after you have users.' },
  { id: 'large-cqrs', type: 'pattern', test: a => a.scale === 'large', text: '500K+ users: separate read and write paths (CQRS), add read replicas and a CDN, and keep analytics off the transactional database.' },
  { id: 'microservices-warn', type: 'warning', test: a => big(a) && a.team === 'solo-fast', text: 'Big scale with a tiny team: resist microservices. Ship a modular monolith until you have far more engineers.' },
  // Project type
  { id: 'ai-rag-private', type: 'tip', test: a => (a['project-type'] === 'ai-product' || a['core-workflow'] === 'ai-chat') && (inc(a, 'compliance', 'hipaa') || inc(a, 'compliance', 'airgapped') || a.infra === 'on-prem'), text: 'AI features with private data: ground answers with retrieval (RAG) and stream responses. Serve an open-weights model such as {{meta-llama.maverick}} inside your own network.' },
  { id: 'ai-rag', type: 'tip', test: a => (a['project-type'] === 'ai-product' || a['core-workflow'] === 'ai-chat') && !(inc(a, 'compliance', 'hipaa') || inc(a, 'compliance', 'airgapped') || a.infra === 'on-prem'), text: 'AI features: ground answers with retrieval (RAG) and stream responses (SSE). {{anthropic.sonnet}} is a balanced default; route cheap calls to {{anthropic.haiku}}.' },
  { id: 'marketplace-trust', type: 'warning', test: a => a['project-type'] === 'marketplace', text: 'Marketplaces: trust and fraud are harder than the tech. Plan identity verification, reviews and dispute handling before onboarding sellers.' },
  { id: 'mobile-offline', type: 'tip', test: a => a['project-type'] === 'mobile', text: 'Mobile: assume intermittent connectivity from day one. Cache locally with SQLite and sync in the background.' },
  { id: 'data-separate', type: 'warning', test: a => a['project-type'] === 'data-platform', text: 'Data platforms: mixing OLTP and OLAP in one Postgres instance lets analytics block transactions. Separate them from day one.' },
  // Skills
  { id: 'python-fastapi', type: 'tip', test: a => inc(a, 'team-skills', 'python') && !inc(a, 'team-skills', 'js-ts'), text: 'Python team: FastAPI for new APIs (async, OpenAPI docs, Pydantic). Django is still great for admin-heavy CRUD products.' },
  { id: 'no-devops', type: 'tip', test: a => a['team-skills'] && !inc(a, 'team-skills', 'devops') && big(a), text: 'No DevOps experience: use Railway, Render or Fly.io instead of Kubernetes, and add error tracking and uptime checks from day one.' },
  { id: 'no-monitoring', type: 'warning', test: big, text: 'Monitoring: add error tracking, structured logs and uptime checks before launch. Otherwise your first outage report comes from users.' },
];

export const INSIGHT_TYPE_LABEL = { warning: 'Warning', pattern: 'Pattern', tip: 'Tip', tool: 'Tool' };

export function evaluateInsights(answers) {
  return INSIGHT_RULES.filter(r => { try { return !!r.test(answers); } catch { return false; } });
}

const SCALING_ROADMAP = {
  tiny: [
    'Month 1–2: one app server (Railway, Render or Fly.io) and one Postgres instance. No Redis yet.',
    'Month 3+: add error tracking and uptime checks; profile slow queries.',
    'Around 1K users: add Redis for sessions and rate limiting; review indexes.',
  ],
  small: [
    'Month 1–3: managed Postgres (Supabase / Neon), deploy on a PaaS, add Redis early.',
    'Month 4–6: CDN for static assets; add a read replica when p99 DB latency passes ~200ms.',
    'Month 6–12: job queue for async work; load-test before major launches.',
  ],
  medium: [
    'Launch: app servers separate from the database; Postgres primary + one replica; Redis for cache and queues.',
    'Month 3: add APM; find and cache the ten slowest queries.',
    'Month 6: CDN for everything, autoscaling app servers, connection pooling.',
    'Month 12: re-evaluate splitting the monolith. At 100K users the answer is usually still no.',
  ],
  large: [
    'Day 1: multi-AZ Postgres with automated failover, Redis cluster, CDN everywhere.',
    'Month 1: observability stack (tracing, structured logs, dashboards).',
    'Month 3: CQRS with read replicas for analytics; async work over an event bus.',
    'Month 6: split out read-heavy services where it clearly pays; hire dedicated DBA/SRE.',
  ],
};

/**
 * The Architect blueprint. Pure: answers in, recommendation out.
 * Every chip id returned exists in the catalog (checked by validateCatalogRefs).
 */
export function getArchRecommendation(answers) {
  const type = answers['project-type'];
  const scale = answers.scale;
  const team = answers.team || 'small-3mo';
  const workflow = answers['core-workflow'];
  const skills = answers['team-skills'] || [];
  const compliance = (answers.compliance || []).filter(v => v !== 'none');
  const patterns = (answers['data-patterns'] || []).filter(v => v !== 'none');
  const infra = answers.infra || 'any-cloud';
  const auth = answers['auth-needs'] || 'basic';
  const privateAI = compliance.includes('airgapped') || compliance.includes('hipaa') || infra === 'on-prem';

  const baseStacks = {
    saas: ['react', 'node-express', 'postgres', 'docker'],
    marketplace: ['react', 'node-express', 'postgres', 'stripe', 'docker'],
    'internal-tool': ['react', 'node-express', 'postgres'],
    'ai-product': ['react', 'python-fastapi', 'postgres', 'pgvector'],
    'api-service': ['node-express', 'postgres', 'docker'],
    mobile: ['react-native', 'node-express', 'postgres'],
    'data-platform': ['python-fastapi', 'postgres', 'elasticsearch', 'docker'],
  };
  const chips = new Set(baseStacks[type] || ['react', 'node-express', 'postgres']);
  const swapBackend = next => { for (const b of ['node-express', 'python-fastapi', 'go', 'java-spring']) chips.delete(b); chips.add(next); };

  // Team skills
  if (skills.includes('python') && !skills.includes('js-ts')) swapBackend('python-fastapi');
  else if (skills.includes('go-rust') && !skills.includes('js-ts') && !skills.includes('python')) swapBackend('go');
  else if (skills.includes('java-csharp') && !skills.includes('js-ts') && !skills.includes('python') && type !== 'ai-product') swapBackend('java-spring');
  if (skills.includes('react') && type !== 'mobile' && type !== 'api-service') chips.add('react');
  if (skills.includes('js-ts') || skills.includes('react')) chips.add('typescript');

  // Infra
  if (infra === 'serverless') chips.add('supabase');
  if (infra === 'edge') { chips.add('cloudflare-workers'); chips.delete('docker'); }
  if (infra === 'containers' || infra === 'on-prem') chips.add('docker');

  // Data patterns
  if (patterns.includes('realtime')) { chips.add('supabase'); chips.add('pat-realtime'); }
  if (patterns.includes('read-heavy') && ['medium', 'large'].includes(scale)) chips.add('redis');
  if (patterns.includes('write-heavy')) { chips.add('redis'); chips.add('pat-job-queues'); }
  if (patterns.includes('fulltext')) chips.add('elasticsearch');
  if (patterns.includes('vector')) chips.add('pgvector');
  if (patterns.includes('offline')) { chips.add('sqlite'); chips.add('pat-local-first'); }
  if (patterns.includes('payments')) chips.add('stripe');
  if (patterns.includes('largefiles')) chips.add('object-storage');

  // Auth
  if (auth !== 'none' && !chips.has('supabase')) chips.add('auth-provider');

  // AI model tier (resolved to a concrete model from the registry at runtime)
  const wantsAI = type === 'ai-product' || workflow === 'ai-chat' || patterns.includes('vector');
  if (wantsAI) chips.add(privateAI ? 'ai-meta-llama-maverick' : 'ai-anthropic-sonnet');
  if (wantsAI && !privateAI && ['medium', 'large'].includes(scale)) chips.add('ai-anthropic-haiku');

  // Compliance
  if (compliance.includes('airgapped')) {
    for (const id of ['supabase', 'firebase', 'vercel-netlify', 'cloudflare-workers', 'stripe']) chips.delete(id);
    chips.add('docker');
  }

  // Scale
  if (scale === 'large') { chips.add('redis'); chips.add('docker-k8s'); chips.add('pat-cqrs'); }

  // Small, fast team: push toward a managed stack
  if (team === 'solo-fast' && !compliance.includes('airgapped')) { chips.add('supabase'); chips.delete('docker'); chips.delete('docker-k8s'); }
  if (chips.has('supabase')) chips.delete('auth-provider');

  // Architecture patterns
  const recPatterns = [];
  if (patterns.includes('offline')) recPatterns.push({ name: 'Local-first', detail: 'SQLite (OPFS) + PowerSync/ElectricSQL for sync. Define the conflict-resolution strategy first.' });
  if (patterns.includes('realtime')) recPatterns.push({ name: 'Event-driven real-time', detail: 'A managed realtime layer (Supabase Realtime, Ably, Liveblocks) + optimistic UI. Avoid hand-rolled WebSocket servers.' });
  if (patterns.includes('write-heavy')) recPatterns.push({ name: 'Async job queue', detail: 'BullMQ (Redis) or pg-boss. Every non-user-facing operation runs async.' });
  if (patterns.includes('vector')) recPatterns.push({ name: 'RAG pipeline', detail: 'Chunk → embed → store in pgvector → retrieve top-k → add to the model context. Add a reranker for quality.' });
  if (scale === 'large') recPatterns.push({ name: 'CQRS', detail: 'Separate read models (replicas, Redis) from the write path. Event sourcing optional.' });
  if (infra === 'edge') recPatterns.push({ name: 'Edge-first', detail: 'Cloudflare Workers + D1 or KV for hot data; cold data stays in the origin Postgres.' });
  if (wantsAI) recPatterns.push({ name: 'Streaming LLM responses', detail: 'Server-Sent Events for token streaming; users perceive streaming as faster at the same total latency.' });
  if (patterns.includes('multitenant')) recPatterns.push({ name: 'Multi-tenant isolation', detail: 'Postgres Row-Level Security per tenant. Never rely on application-side filtering alone.' });

  // Startup traps for this combination
  const trapKeys = [];
  if (['crud', 'collab', 'transactions'].includes(workflow)) trapKeys.push('n1-queries');
  if (['medium', 'large'].includes(scale)) trapKeys.push('no-indexes');
  if (infra === 'serverless') trapKeys.push('no-connection-pool');
  if (type === 'mobile' && !patterns.includes('offline')) trapKeys.push('mobile-offline');
  if (patterns.includes('largefiles')) trapKeys.push('blob-in-db');
  if (type === 'saas' && !patterns.includes('multitenant') && scale !== 'tiny') trapKeys.push('no-rls');
  if (['medium', 'large'].includes(scale) && team === 'solo-fast') trapKeys.push('microservices-early');
  if (patterns.includes('write-heavy') || workflow === 'transactions') trapKeys.push('no-queue');
  if (['content', 'search-discovery'].includes(workflow) && ['saas', 'marketplace'].includes(type)) trapKeys.push('spa-seo');
  trapKeys.push('no-migrations');
  if (!trapKeys.includes('no-indexes')) trapKeys.push('no-monitoring');
  const traps = [...new Set(trapKeys)].slice(0, 5).map(k => ({ key: k, ...FAILURE_PATTERNS[k] }));

  // Alternatives
  const alternatives = [];
  if ((team === 'solo-fast' || team === 'small-3mo') && !compliance.includes('airgapped')) {
    alternatives.push({ name: 'Supabase BaaS (fastest launch)', when: 'You want to ship in under four weeks',
      tradeoff: 'Auth, Postgres, storage, realtime and edge functions in one platform with zero ops. Some lock-in at large scale, but you will not hit that for a long time.' });
  }
  if (!skills.includes('python') && type !== 'mobile') {
    alternatives.push({ name: 'T3-style stack (Next.js + tRPC + Prisma + Tailwind)', when: 'A TypeScript-first full-stack team',
      tradeoff: 'End-to-end type safety from database to UI and excellent DX. Server Components shrink the client bundle; Vercel makes deploys trivial.' });
  }
  if (wantsAI) {
    alternatives.push({ name: 'Agent framework + Vercel AI SDK', when: 'You need multi-step agents, tools and routing',
      tradeoff: 'Frameworks (LangGraph, the Claude Agent SDK, OpenAI Agents SDK) handle tool loops and memory; the AI SDK gives streaming React hooks. More moving parts than direct API calls, so add them only when you need agents.' });
  }
  if (scale === 'large' && !chips.has('docker-k8s')) {
    alternatives.push({ name: 'Kubernetes platform', when: 'You have (or will hire) a platform team',
      tradeoff: 'Autoscaling, self-healing and standardized deploys across services, at the cost of real operational overhead.' });
  }

  // Extra rules for the generated .cortex config
  const rules = [];
  if (patterns.includes('multitenant')) rules.push('! Every query on tenant data is scoped by tenant (Row-Level Security or an enforced tenant_id filter)');
  if (compliance.includes('hipaa')) rules.push('! Never log PHI; audit-log every PHI read and write');
  if (compliance.includes('gdpr')) rules.push('! Personal data stays in EU regions; every new personal-data field needs an erasure path');
  if (compliance.includes('airgapped')) rules.push('! No code path may call an external network service');
  if (compliance.includes('soc2')) rules.push('Every privileged action writes a structured audit log entry (actor, action, target, time)');
  if (compliance.includes('pci')) rules.push('! Raw card data never touches our servers or logs');
  if (patterns.includes('realtime')) rules.push('Use optimistic UI updates and reconcile with server state');
  if (['crud', 'collab', 'transactions'].includes(workflow)) rules.push('Eager-load relations for list endpoints; no queries inside loops');

  return {
    chips: [...chips], patterns: recPatterns, traps,
    warnings: evaluateInsights(answers).filter(i => i.type === 'warning'),
    scalingRoadmap: SCALING_ROADMAP[scale] || [],
    alternatives, similar: SIMILAR_PRODUCTS[type] || null, rules,
  };
}

// ── Catalog assembly & model resolution ────────────────────────────────────

/** Resolve a model slot to a concrete registry model, or null. */
export function resolveSlot(registry, vendor, key) {
  const id = registry?.highlights?.[vendor]?.[key];
  const m = id && registry.models?.[id];
  return m ? { id, ...m } : null;
}

/** Replace {{vendor.key}} placeholders with the current registry model name. */
export function fillModels(text, registry) {
  return String(text).replace(/\{\{([\w-]+)\.([\w-]+)\}\}/g, (_, vendor, key) => {
    const m = resolveSlot(registry, vendor, key);
    if (m) return m.name;
    const slot = MODEL_SLOTS.find(s => s.vendor === vendor && s.key === key);
    return slot ? `${slot.label} (current tier)` : `${vendor} ${key}`;
  });
}

/**
 * Build the full catalog: static tech + model slots (resolved) + coding tools.
 * @param {{ registry?: object|null, targets?: object }} deps
 */
export function buildCatalog({ registry = null, targets = {} } = {}) {
  const models = MODEL_SLOTS.map(s => {
    const m = resolveSlot(registry, s.vendor, s.key);
    return { ...s, category: 'ai', model: m, available: !!m,
      label: m ? m.name : s.label, tier: s.label,
      why: `${s.label} tier${m ? ` (currently ${m.name})` : ''}. ${s.bestFor[0]}.` };
  });
  const tools = TOOL_SLOTS.map(t => {
    const name = targets[t.target]?.name || t.fallback;
    return { ...t, category: 'tools', label: t.prefix ? `${t.prefix} (${name})` : name,
      mainFile: targets[t.target]?.mainFile || '', why: `${name}: ${t.bestFor[0]}.` };
  });
  return [...TECH, ...models, ...tools];
}

/** Every catalog id referenced by presets, matrix and the architect (for the self-check). */
export function referencedIds() {
  const refs = new Map(); // id -> where
  const add = (id, where) => { if (!refs.has(id)) refs.set(id, where); };
  for (const row of MATRIX) row.stack.forEach(id => add(id, `MATRIX "${row.name}"`));
  for (const [k, p] of Object.entries(PRESETS)) p.chips.forEach(id => add(id, `PRESETS.${k}`));
  // Exercise the architect with every option of every step.
  const base = { 'project-type': 'saas', 'core-workflow': 'crud', scale: 'small', team: 'small-3mo', 'data-patterns': [], 'auth-needs': 'basic', infra: 'any-cloud', 'team-skills': ['js-ts'], compliance: ['none'] };
  const allMulti = Object.fromEntries(ARCH_STEPS.filter(s => s.multi).map(s => [s.id, s.options.filter(o => !o.exclusive).map(o => o.value)]));
  for (const step of ARCH_STEPS) {
    for (const opt of step.options) {
      for (const extra of [{}, allMulti]) {
        const a = { ...base, ...extra, [step.id]: step.multi ? [opt.value] : opt.value };
        getArchRecommendation(a).chips.forEach(id => add(id, `getArchRecommendation(${step.id}=${opt.value})`));
      }
    }
  }
  return refs;
}

/** Returns a list of problems (empty = OK). */
export function validateCatalogRefs(catalog = buildCatalog()) {
  const ids = new Set(catalog.map(t => t.id));
  const problems = [];
  const seen = new Set();
  for (const t of catalog) { if (seen.has(t.id)) problems.push(`duplicate catalog id "${t.id}"`); seen.add(t.id); }
  for (const [id, where] of referencedIds()) if (!ids.has(id)) problems.push(`unknown id "${id}" referenced by ${where}`);
  for (const k of Object.keys(FAILURE_PATTERNS)) if (!FAILURE_PATTERNS[k]?.text) problems.push(`FAILURE_PATTERNS.${k} has no text`);
  return problems;
}

// ── .cortex config generation ──────────────────────────────────────────────
const CAT_HEADINGS = { frontend: 'Frontend', backend: 'Backend', database: 'Data', cloud: 'Infrastructure', services: 'Services', patterns: 'Architecture' };
const FRONTEND_SCOPES = {
  nextjs: ['**/*.tsx', '**/*.jsx'], react: ['**/*.tsx', '**/*.jsx'], 'react-native': ['**/*.tsx', '**/*.jsx'],
  vue: ['**/*.vue'], svelte: ['**/*.svelte'], angular: ['**/*.component.ts', '**/*.component.html'],
};
const FRAMEWORK_ORDER = ['nextjs', 'react-native', 'python-fastapi', 'python-django', 'ruby-rails', 'java-spring', 'dotnet', 'go', 'angular', 'vue', 'svelte', 'react', 'node-express'];
const LANG_ORDER = ['python-fastapi', 'python-django', 'go', 'java-spring', 'dotnet', 'ruby-rails', 'typescript', 'nextjs', 'react-native', 'node-express', 'react', 'vue', 'angular', 'svelte', 'serverless', 'cloudflare-workers', 'html-css'];

export function slugName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'my-app';
}

/** project.language / project.framework from the selection. */
export function projectMeta(selected, catalog) {
  const byId = new Map(catalog.map(t => [t.id, t]));
  const lang = LANG_ORDER.map(id => selected.includes(id) && byId.get(id)?.lang).find(Boolean) || null;
  const fwId = FRAMEWORK_ORDER.find(id => selected.includes(id));
  return { language: lang, framework: fwId ? byId.get(fwId)?.framework || null : null };
}

/** Enabled compile targets from the chosen coding tools (or the default set). */
export function targetsFromSelection(selected, targetIds) {
  const picked = TOOL_SLOTS.filter(t => selected.includes(t.id)).map(t => t.target).filter(t => targetIds.includes(t));
  return picked.length ? picked : DEFAULT_TARGETS.filter(t => targetIds.includes(t));
}

/**
 * Generate real, CLI-compatible .cortex files.
 * @param {object} o
 * @param {string[]} o.selected     catalog ids
 * @param {object[]} o.catalog      from buildCatalog()
 * @param {string}   o.name         project name
 * @param {string[]} o.targets      enabled target ids
 * @param {string[]} o.targetIds    all TARGET_IDS (every provider key is written)
 * @param {Function} o.stringify    YAML stringify from the engine
 * @param {string[]} [o.extraRules] preset / architect rules
 * @param {string}   [o.title]      stack name for the header comment
 * @returns {{ files: Record<string,string>, config: object, targets: string[] }}
 */
export function buildCortexFiles({ selected, catalog, name, targets, targetIds, stringify, extraRules = [], title = '' }) {
  const byId = new Map(catalog.map(t => [t.id, t]));
  const items = selected.map(id => byId.get(id)).filter(Boolean);
  const meta = projectMeta(selected, catalog);
  const project = { name: slugName(name), language: meta.language, framework: meta.framework };
  const config = {
    version: 2,
    project,
    providers: Object.fromEntries(targetIds.map(id => [id, targets.includes(id)])),
    output: { agentsMd: 'shared', skills: true },
  };
  const yaml = `# Cortex configuration — generated by Stack Lab (https://cortex1.vercel.app/stack.html)\n# Docs: https://cortex1.vercel.app/docs.html#config\n\n${stringify(config)}\n`;

  // Scoped frontend file when there is a framework with a clear file pattern and something else to separate from.
  const fe = items.find(t => FRONTEND_SCOPES[t.id]);
  const splitFrontend = !!fe && items.some(t => t.category === 'backend');
  const files = {};
  const lines = ['# Project rules', ''];
  const stackBits = CATEGORIES.filter(c => c.id !== 'tools')
    .map(c => [c.label, items.filter(t => t.category === c.id).map(t => t.label)])
    .filter(([, l]) => l.length);
  if (stackBits.length) {
    lines.push('## Stack');
    for (const [label, l] of stackBits) lines.push(`- ${label}: ${l.join(', ')}`);
    lines.push('- Do not introduce a new framework, database or service without an explicit request', '');
  }
  const seen = new Set();
  const push = (arr, r) => { const k = r.replace(/^!\s*/, '').toLowerCase(); if (!seen.has(k)) { seen.add(k); arr.push(r); } };
  for (const cat of ['frontend', 'backend', 'database', 'cloud', 'services', 'patterns']) {
    if (cat === 'frontend' && splitFrontend) continue;
    const rules = [];
    for (const t of items.filter(x => x.category === cat)) (t.rules || []).forEach(r => push(rules, r));
    if (rules.length) { lines.push(`## ${CAT_HEADINGS[cat]}`, ...rules.map(r => `- ${r}`), ''); }
  }
  const aiItems = items.filter(t => t.category === 'ai');
  if (aiItems.length) {
    lines.push('## AI features');
    const avail = aiItems.filter(t => t.model);
    if (avail.length) {
      const [def, ...rest] = avail;
      lines.push(`- Default model: ${def.model.name} (\`${def.model.id}\`); change it in one place (the LLM service module)`);
      for (const r of rest) lines.push(`- Also approved: ${r.model.name} (\`${r.model.id}\`) — ${r.tier} tier`);
    }
    lines.push('- Model ids come from configuration, never hardcoded in feature code');
    lines.push('');
  }
  const extras = [];
  for (const r of extraRules) push(extras, r);
  if (extras.length) lines.push('## Project conventions', ...extras.map(r => `- ${r}`), '');
  lines.push('## Safety', '- ! Never commit secrets, API keys or .env files', '- ! Validate all external input at the boundary', '');
  lines.push('## Workflow', '- Every bug fix ships with a failing test first', '- Run the test suite and linter before calling work done', '');
  files['.cortex/rules/project.md'] = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

  if (splitFrontend) {
    const rules = [];
    for (const t of items.filter(x => x.category === 'frontend')) (t.rules || []).forEach(r => push(rules, r));
    if (rules.length) {
      const scope = FRONTEND_SCOPES[fe.id];
      const names = items.filter(x => x.category === 'frontend' && x.rules?.length).map(x => x.label).join(', ');
      files['.cortex/rules/frontend.md'] = `---\nscope: [${scope.map(s => `"${s}"`).join(', ')}]\ndescription: Frontend conventions (${names})\n---\n# Frontend\n\n## Components\n${rules.map(r => `- ${r}`).join('\n')}\n`;
    }
  }
  const out = { '.cortex/config.yaml': yaml, ...files };
  return { files: out, config: { project }, targets: [...targets], title };
}
