# Rooftop Solar: lead to project

A small app for Company A (Nagpur): homeowners submit a lead and bill photo, the system says who is worth a visit and what size fits, sales sends a same-day quote with subsidy and payback, and the project is tracked to "subsidy credited" with a customer status link.

> Bill reading is **simulated** in this build (see [docs/AI.md](docs/AI.md)). Messages, OTP and payments are mocked.

_Screenshots: placeholder, added at the end of Day 3._

## Quick start
```bash
npm install
cp .env.example .env.local   # fill in names listed there
npm run db:migrate && npm run db:seed
npm run dev
```
Full steps and demo logins: [deployment.md](deployment.md).

## Docs
[PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Plan](docs/IMPLEMENTATION_PLAN.md) · [Design](docs/DESIGN_SYSTEM.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [AI](docs/AI.md) · [Assumptions](docs/ASSUMPTIONS.md) · [i18n](docs/I18N.md)
