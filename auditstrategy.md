# Claude Code Full E2E Audit Strategy

## Overview

Two-phase approach:
1. **Phase 1 (Kickoff):** Claude Code scans the codebase and generates `auditprompt.md`
2. **Phase 2 (Ralph-Loop):** You feed `auditprompt.md` into ralph-loop for continuous execution

---

## PHASE 1: Kickoff Prompt

Paste this into Claude Code as a single message (NOT ralph-loop). This is a one-time generation step.

```
Scan this entire Next.js and Supabase codebase and generate a file called auditprompt.md at the project root. This file will be used as the master instruction set for an automated full E2E audit loop. Here is what auditprompt.md must contain:

SECTION 1 - CODEBASE MAP
Crawl every directory. List every page route, API route, server action, middleware, component, hook, utility, database table, RLS policy, edge function, and Supabase trigger. Organize them by domain or feature area.

SECTION 2 - RBAC MATRIX
Identify every role defined in the system. For each role document exactly which routes they can access, which API endpoints they can call, which UI elements they should see or not see, and which database rows they should be able to read or write. Present this as a matrix.

SECTION 3 - TEST PERSONAS
Define 10 test user personas that collectively cover every role and permission combination. For each persona specify their name, email, role, expected permissions, and what features they should and should not have access to. Use realistic marketing agency titles like CEO, Account Director, Account Manager, Strategist, Designer, Analyst, Client Contact, Intern, Contractor, and Suspended User.

SECTION 4 - TEST PLAN
For every single feature in the codebase create a test entry with the following fields:
- ID: unique identifier like F001
- Feature: name of the feature
- Area: frontend or backend or both
- Route or file: where it lives
- Test steps: numbered steps a human would take to test it
- Personas to test: which of the 10 personas should test this and what the expected outcome is for each
- RBAC expectations: what should be allowed vs denied per role
- Edge cases: empty states, error states, boundary conditions
- Status: NOT STARTED by default
- Notes: empty by default

Include tests for these categories at minimum:
- Authentication flows including signup, login, logout, password reset, session expiry
- User management including inviting users, assigning roles, removing users, role changes propagating permissions
- Every page render for each persona
- Every button and interactive element on every page
- Every form submission with valid data, invalid data, and empty data
- Every API route with authorized requests, unauthorized requests, and malformed requests
- Every RLS policy verified by attempting cross-tenant or cross-role data access
- Navigation flows and redirects per role
- Loading states, error boundaries, and empty states
- Responsive layout at desktop, tablet, and mobile widths
- Real time subscriptions if any
- File uploads if any
- Search and filtering features
- Pagination
- Notifications or email triggers
- Any third party integrations

SECTION 5 - AUDIT LOG FORMAT
Define the format for FULLAUDIT.md entries. Each entry should follow this template:

## FXXX - Feature Name
- Status: PASS or FAIL or FIXED or SKIPPED
- Tested by personas: list
- Date: timestamp
- Issues found: description or none
- Fix applied: description or N/A
- Files modified: list or none
- Retested after fix: YES or NO
- Final status: PASS or FAIL

SECTION 6 - EXECUTION RULES
Include these rules at the top of auditprompt.md so the ralph-loop agent follows them:
1. Before doing anything read FULLAUDIT.md to see what has been completed
2. Pick the next NOT STARTED item from the test plan
3. Actually navigate to or invoke the feature. Do not just read code and assume it works. Use the test steps.
4. For frontend tests create or use a Playwright or Cypress test file if a testing framework is set up. If not then do manual code review plus runtime verification.
5. For backend tests use curl or a test script to hit API routes with different auth tokens per persona.
6. If something is broken fix it immediately then retest.
7. After each item update FULLAUDIT.md with the result.
8. Never skip an item. If blocked document why and move to the next item then come back.
9. Track cumulative stats at the top of FULLAUDIT.md showing total items, passed, failed, fixed, and remaining.
10. If you encounter a feature not in the test plan add it to both auditprompt.md and the test plan then test it.

Generate auditprompt.md now. Be exhaustive. Do not summarize or abbreviate. I want every single testable thing in this codebase documented.
```

---

## PHASE 2: Ralph-Loop Command

After Claude Code generates `auditprompt.md`, review it and make any edits. Then kick off the ralph-loop.

**IMPORTANT:** This must be pasted as ONE LINE with no line breaks.

```
/ralph-loop:ralph-loop Read auditprompt.md at the project root. This is your master instruction set. Follow every rule in Section 6. Check FULLAUDIT.md for progress. Pick the next untested item. Test it across all required personas. If broken fix it and retest. Log everything to FULLAUDIT.md. Do not stop. Do not skip. Do not repeat completed items.
```

---

## Tips for Success

### Before kicking off Phase 2:
- Make sure you have a git branch for this (e.g., `git checkout -b full-audit`)
- Commit current state so you can diff all changes the agent makes
- Review the generated `auditprompt.md` to verify it actually found everything

### If the loop stalls or repeats:
- Check `FULLAUDIT.md` to see where it got stuck
- You can manually update a status to `SKIPPED` to move past blockers
- Restart the loop and it will pick up from where it left off

### Managing token context:
- The `auditprompt.md` file acts as external memory so the agent does not need to hold everything in context
- `FULLAUDIT.md` acts as a persistent progress tracker across loop iterations
- Each iteration the agent reads both files fresh so it never loses track

### Setting ralph-loop limits:
- Consider using `--max-iterations 50` for the first run to review progress before going unlimited
- You can always restart with a new ralph-loop and it picks up from FULLAUDIT.md

---

## Optional: Supabase Test Seed Script

You may also want to ask Claude Code to generate a seed script that creates all 10 test personas in your Supabase database with the correct roles before running the audit. Prompt:

```
Based on the 10 test personas defined in auditprompt.md create a Supabase seed script at scripts/seed-test-users.ts that creates all 10 users with their assigned roles and any required related data. Use the Supabase admin client. Make the passwords follow the pattern TestUser1 through TestUser10. Output the credentials to the console when run.
```
