# Example Skill: Code Review
# Skills are reusable instruction sets that can be composed into your AI context.
# Place skill files in .cortex/skills/ and reference them in config.yaml.

## Purpose
Perform thorough code reviews focusing on correctness, security, and maintainability.

## Instructions
When reviewing code:
1. Check for security vulnerabilities (injection, XSS, CSRF, etc.)
2. Verify error handling covers edge cases
3. Look for performance bottlenecks
4. Ensure consistent naming conventions
5. Validate that tests cover the changes
6. Check for proper input validation at boundaries

## Response Format
- Start with a brief summary
- List issues by severity (critical, warning, suggestion)
- Include specific line references
- Suggest concrete fixes for each issue
