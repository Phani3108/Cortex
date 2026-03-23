# Skill: Debugging Strategy
# Systematic approach to diagnosing and fixing bugs.
# Applies scientific method to software debugging.

## Purpose
Efficiently diagnose root causes rather than treating symptoms.

## Instructions
When debugging an issue:
1. **Reproduce first** — confirm the exact steps to trigger the bug
2. **Read the error** — parse stack traces, error codes, and log output carefully
3. **Form a hypothesis** — based on the error, propose the most likely cause
4. **Narrow the scope** — use binary search (comment out half the code) to isolate
5. **Check recent changes** — use `git log` and `git diff` to find what changed
6. **Verify assumptions** — add assertions or log statements at key decision points
7. **Fix the root cause** — don't patch symptoms; trace to the origin
8. **Write a regression test** — ensure the specific bug can never return
9. **Check for siblings** — the same pattern may exist elsewhere in the codebase

## Anti-Patterns to Avoid
- Don't change multiple things at once while debugging
- Don't assume the bug is in the code you wrote — check dependencies too
- Don't ignore intermittent failures — they reveal race conditions or state issues
- Don't remove error handling to "fix" errors
