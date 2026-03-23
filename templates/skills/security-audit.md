# Skill: Security Audit
# Perform comprehensive security analysis of code changes.
# Based on OWASP Top 10 and real-world vulnerability patterns.

## Purpose
Identify security vulnerabilities before they reach production.

## Instructions
When auditing code for security:
1. Check for injection vulnerabilities (SQL, XSS, command injection, SSRF)
2. Verify authentication and authorization at every boundary
3. Ensure sensitive data is never logged, exposed in errors, or stored in plaintext
4. Validate all external input — user input, API responses, file contents
5. Check cryptographic usage: no hardcoded secrets, proper algorithm choices, secure randomness
6. Verify CORS, CSP, and security headers configuration
7. Look for race conditions in concurrent code paths
8. Check dependency versions against known CVE databases
9. Ensure proper error handling that doesn't leak internal state
10. Verify that file operations use safe paths (no path traversal)

## Response Format
- Classify findings as: CRITICAL, HIGH, MEDIUM, LOW
- Include the specific CWE/OWASP category
- Show the vulnerable code and the fixed version
- Prioritize by exploitability and impact
