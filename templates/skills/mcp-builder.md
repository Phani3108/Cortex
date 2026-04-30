# Skill: MCP Builder
# Build and evolve Model Context Protocol servers and tools.

## Purpose
Help users define MCP resources and tools with safe contracts and versioned evolution.

## Instructions
For MCP implementation tasks:
1. Start with capability map:
   - Resources to expose
   - Tools to execute
   - Prompts to provide
2. For each tool, define:
   - Name and version
   - JSON schema for input
   - JSON schema for output
   - Error codes and messages
3. Enforce strict validation at MCP boundaries.
4. Add authorization checks before tool execution.
5. Add auditing for all mutating operations.
6. Keep a compatibility policy:
   - Additive changes are minor versions
   - Breaking changes require new major namespace

## Response Pattern
- Give a step-by-step plan first.
- Show a minimal example tool contract.
- Show one backward-compatible expansion example.

## Pitfalls to Surface
- Shipping tools without schema validation
- Mixing internal error messages with user-safe error outputs
- No rate limiting for expensive tools
- Breaking clients by changing required fields

## Expansion Paths
- Add capability discovery endpoints
- Add tenant-aware tool routing
- Add policy-based tool enablement by environment
