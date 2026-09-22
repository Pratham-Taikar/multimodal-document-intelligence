# Root Test Suite

Reserved for future **integration** and **end-to-end** test suites that span
multiple services (e.g. frontend → backend → PostgreSQL workflows).

Current test locations:

- `backend/tests/` — backend unit & API tests (pytest)
- `frontend/src/test/` — frontend rendering tests (Vitest + Testing Library)

No cross-service tests are defined during the scaffolding phase; they will be
added together with the features they cover in later milestones.
