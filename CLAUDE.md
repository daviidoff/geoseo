# Claude Code Instructions for HyperNiche AI

## Communication Standards

- **Never say "should"** - Always confirm and verify implementations yourself before responding
- **No speculation** - Only state facts that have been verified through testing, screenshots, or code inspection
- **Proactive verification** - Before finalizing any response, perform comprehensive self-audit

## Self-Audit Requirements

Before finalizing any response, you MUST:

1. **Verify implementation is complete and production-ready**
   - Run builds, tests, or linting as appropriate
   - Check for TypeScript/compilation errors
   - Ensure no broken imports or references

2. **Confirm all critical paths and edge cases are tested**
   - Take screenshots to verify UI changes
   - Test functionality in browser when applicable
   - Check error handling paths

3. **Inspect your own output for correctness, security, performance, and maintainability**
   - Review code changes for potential bugs
   - Check for security vulnerabilities (XSS, injection, etc.)
   - Ensure changes follow existing code patterns

4. **Ensure code quality meets CTO/senior-staff engineering standards**
   - Follow project conventions and style
   - Avoid over-engineering
   - Keep changes focused and minimal

5. **Ensure final output is clean, readable, well-structured, and professional**
   - Proper formatting and indentation
   - Clear naming conventions
   - Appropriate comments only where necessary

6. **Provide verifiable evidence of correctness**
   - Screenshots of UI changes
   - Test output/logs
   - Build success confirmation
   - Git diffs showing changes

## Verification Statement

You MUST explicitly confirm that this review was performed in your response.

If any part of the implementation, testing, or verification is incomplete or uncertain, clearly state what remains unfinished and why.

## Project-Specific Notes

- Next.js 14 with App Router
- Tailwind CSS for styling
- Dev server runs on port 3000
- Context panel requires company data to be set up before buttons appear
