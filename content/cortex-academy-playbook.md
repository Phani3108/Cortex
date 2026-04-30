# Cortex Academy: Build AI Agents and MCP Systems in Phases

This guide is for builders who want to move from idea to a working AI system without skipping architecture, safety, and contract discipline.

The model is simple:
- Pick constraints first
- Build the smallest reliable slice
- Add contracts and guardrails before scale
- Expand with clear migration paths

## How to Use This Playbook

For each phase:
1. Complete the goal
2. Run the validation checklist
3. Review pitfalls before moving forward
4. Choose one expansion path only when the current phase is stable

Suggested Cortex setup:

```bash
cortex add skill stack-selection
cortex add skill tutorial-coach
cortex add skill agent-foundations
cortex add skill mcp-builder
cortex add skill api-contract-engineering
cortex compile
```

## Phase 0: Pick Your Build Lane

### Goal
Choose one of three lanes and lock a baseline stack.

### Lanes
- Lane A: AI assistant app with API backend
- Lane B: Tool-using AI agent with workflow steps
- Lane C: MCP server with contract-driven tools

### Step
Define your first release constraints:
- Target users
- Budget ceiling per month
- Response latency target
- Team size and stack familiarity
- Compliance boundary (none/basic/regulated)

### Sample Decision Matrix

| Area | Option 1: Fast Ship | Option 2: Balanced | Option 3: Enterprise |
|---|---|---|---|
| Frontend | Next.js | React + Vite | Next.js + design system |
| Backend | Node + Fastify | Node + NestJS | .NET/Java service layer |
| LLM | Managed API single model | Router with primary + fallback | Multi-model policy routing |
| DB | Postgres | Postgres + Redis | Postgres + Redis + warehouse |
| Vector | pgvector | dedicated vector DB | dedicated vector DB + re-ranker |
| Deploy | Vercel + managed DB | Container Apps/Kubernetes lite | Kubernetes + policy platform |

### Validation Checklist
- Constraints are documented and approved
- A primary stack is selected
- A fallback stack is selected
- You know what success means in 30 days

### Common Pitfalls
- Picking model and framework before defining latency and budget
- Starting with microservices for a team smaller than five
- No fallback model strategy

### Expansion Ideas
- Add a model router after proving baseline quality
- Add queue workers when tasks exceed request time limits

## Phase 1: Define Contracts Before Code

### Goal
Create stable contracts for prompts, tools, and APIs.

### Step
Create these contracts first:
- Agent input/output/error schema
- MCP tool input/output/error schema
- API endpoint contracts with versioning notes

### Sample API Contract (Minimal)

```yaml
openapi: 3.1.0
info:
  title: Agent Task API
  version: 1.0.0
paths:
  /tasks/plan:
    post:
      summary: Produce a step plan for a user goal
      requestBody:
        required: true
      responses:
        '200':
          description: Plan produced
        '400':
          description: Invalid request
        '429':
          description: Budget/rate limit exceeded
```

### Validation Checklist
- Every tool has explicit JSON schema
- Every API endpoint has success and error payload examples
- Versioning policy is written

### Common Pitfalls
- Changing required fields without version bump
- Ambiguous error payloads
- No idempotency policy on write endpoints

### Expansion Ideas
- Add consumer-driven contract tests
- Add event contracts for async workflows

## Phase 2: Build a Basic Agent Safely

### Goal
Ship a single-objective agent that can run end-to-end with guardrails.

### Step
Build this minimum loop:
1. Validate user input
2. Create bounded prompt context
3. Call model with max tokens and timeout
4. Optionally execute one approved tool
5. Return structured output

### Sample Agent Loop (Pseudo)

```text
input -> validate -> plan -> model_call -> optional_tool -> response
                 | fail                          | fail
                 v                               v
              error schema                    fallback path
```

### Validation Checklist
- Token budget limit exists
- Timeout and retry limits exist
- Tool whitelist exists
- Safe mode exists (suggest-only, no writes)

### Common Pitfalls
- Letting model invent tool arguments
- No fallback for tool failures
- Prompt injection not separated from system policy

### Expansion Ideas
- Add planner/executor separation
- Add human approval step for high-risk actions

## Phase 3: Add MCP Capability

### Goal
Expose reliable tool capabilities through MCP with compatibility discipline.

### Step
Implement MCP in increments:
1. Add one read-only tool
2. Add strict validation and error mapping
3. Add one mutating tool with audit log
4. Add capability discovery and version tags

### Validation Checklist
- Tool schemas are validated server-side
- Mutating tools enforce authorization
- Every tool call is auditable
- Backward compatibility policy is documented

### Common Pitfalls
- Shipping mutating tools without auth checks
- Mixing internal exceptions into external responses
- Breaking clients with silent schema changes

### Expansion Ideas
- Environment-based tool policy (dev/stage/prod)
- Tenant-aware routing

## Phase 4: Evolve API Contracts and Agent Quality

### Goal
Make iteration safe while improving quality and reliability.

### Step
Install a quality loop:
- Contract tests on every PR
- Golden test cases for prompts
- Eval runs for core user journeys
- Observability for model latency, cost, failures

### Validation Checklist
- At least 10 golden eval cases exist
- Contract test suite blocks breaking changes
- Dashboard includes token cost and failure reasons

### Common Pitfalls
- Optimizing prompts without regression tests
- Contract changes without migration notes
- No incident response path for model outages

### Expansion Ideas
- Automated canary for model version upgrades
- Dynamic routing by latency/cost SLO

## Phase 5: Scale Deliberately

### Goal
Scale architecture only where bottlenecks are proven.

### Step
Scale in this order:
1. Caching and retrieval quality
2. Queue-based async execution
3. Model routing and fallback policy
4. Multi-tenant isolation and governance

### Validation Checklist
- You can explain your top 3 cost drivers
- You can fail over between model options
- You can trace one user request across all systems

### Common Pitfalls
- Premature multi-agent orchestration
- No governance on tool usage and spend
- No clear ownership of contracts and model policy

## Video Companion Ideas (Tutorial Series)

Use these as modules for short videos (8-12 min each):
1. Episode 1: Pick stack, model, and DB using constraints
2. Episode 2: Contract-first APIs and tool schemas
3. Episode 3: Build your first safe single-task agent
4. Episode 4: Convert tools into MCP capabilities
5. Episode 5: Add evals, telemetry, and fallback models

Each episode should end with:
- One checkpoint
- One failure mode demo
- One expansion challenge

## Suggested Next Prompt Patterns for Cortex Users

- "Act as tutorial coach. We are in Phase 1. Ask only the minimum questions needed to finalize contracts."
- "Generate three stack options for our constraints with trade-offs and a recommendation."
- "Review this API contract for backward compatibility risks."
- "Turn this tool spec into an MCP-safe contract with validation and error schema."

## Final Advice

Speed comes from structure, not shortcuts.

The teams that win are not the teams with the most prompts. They are the teams with the clearest contracts, measurable quality loops, and disciplined expansion paths.
