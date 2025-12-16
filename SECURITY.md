# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | Yes                |

## Reporting a Vulnerability

We take security seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT open public GitHub issues for security vulnerabilities.**

Instead, email us directly at: **jitigges@vt.edu**

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Depends on severity

### What to Expect

1. We will acknowledge receipt of your report
2. We will investigate and validate the issue
3. We will work on a fix
4. We will notify you when the fix is released
5. We will credit you (if desired) in the release notes

### Safe Harbor

We support responsible disclosure. If you follow these guidelines, we will not pursue legal action against you:

- Give us reasonable time to fix the issue before public disclosure
- Do not access or modify data belonging to others
- Do not disrupt our services
- Act in good faith

## Security Architecture

For detailed information about our security implementation, see:
- [Security Implementation Guide](docs/security/SECURITY.md)

Our application implements:
- Row Level Security (RLS) on all database tables
- Input validation with Zod schemas
- Rate limiting with Upstash Redis
- Security headers (CSP, HSTS, etc.)
- 136 granular permissions across 15 categories
- Audit logging for critical changes

## Contact

Security concerns: jitigges@vt.edu
