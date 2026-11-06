---
name: release-checklist
description: Pre-submit checks for the final ZIP.
---
- [ ] gitleaks / secret scan clean; `git log -p` has no secrets; .env* ignored
- [ ] `npm run lint && npm run typecheck && npm test && npm run e2e` green; rules coverage ≥ 95%
- [ ] `npm audit` reviewed
- [ ] Lighthouse mobile recorded (real numbers only)
- [ ] Demo logins work on the live URL
- [ ] docs/TDD.md, deployment.md, CHANGELOG, README updated; ASSUMPTIONS complete
- [ ] Repo public; clean-clone run works
- [ ] ZIP contains exactly: TDD (PDF/Word) + deployment.md
