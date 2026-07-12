# MoMo FraudLink Uganda

MoMo FraudLink is a closed, synthetic fraud-intelligence exchange demonstrating how regulated Ugandan institutions can correlate protected identifiers and transaction relationships under Bank of Uganda oversight. A relationship is a risk signal—not proof that a linked customer committed fraud. The receiving institution owns the operational decision.

## Architecture

- React 19, TypeScript and Vite preserve the existing fraud-operations interface.
- FastAPI exposes versioned REST endpoints, OpenAPI documentation, background correlation and authenticated WebSockets.
- SQLAlchemy 2.x models institutions, users, incidents, subjects, transactions, relationships, alerts and audit events.
- PostgreSQL 16 is the intended development/runtime database; SQLite is the zero-configuration fallback and automated-test database.
- Alembic owns the database schema lifecycle.
- A Python rule engine performs explainable correlation; no AI or machine-learning claim is made.
- Synthetic transaction simulation runs as a lifespan-managed asyncio task, not an infinite FastAPI background task.

The scoring weights are prototype rules and are **not official Bank of Uganda fraud-scoring standards**. All included records are synthetic. This project does not connect to production systems operated by Bank of Uganda, MTN, Airtel, NIRA, Stanbic, Centenary, or any other institution.

## Standards alignment

The design references ISO/IEC 27001:2022 and ISO/IEC 27002:2022 for information-security governance and controls; ISO/IEC 27701:2025 and ISO/IEC 29100:2024 for privacy management and privacy principles; ISO/IEC 27035-1:2023 for incident-management lifecycle; ISO 22301:2019 for continuity planning; and the ISO 20022 series as a future financial-message interoperability target.

See the [ISO standards traceability matrix](docs/standards-alignment.md) for the relationship between each standard, implemented evidence, and remaining production controls. This is a standards-aligned prototype and **not a claim of ISO certification or conformity**.

## Setup

Requirements: Node.js 20+, npm 10+, Python 3.10+, Docker Desktop (for PostgreSQL).

```bash
cp .env.example .env
docker compose up -d postgres
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
alembic upgrade head
python -m backend.scripts.seed
```

Start the API:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. API documentation is at `http://127.0.0.1:8000/docs`.

The frontend calls `/api/v1` and `/ws/events`; during local development Vite proxies both to FastAPI on port 8000. For separate deployments, set `VITE_API_BASE_URL` to the public backend origin (for example `https://api.example.com`) before building the frontend. `VITE_WS_BASE_URL` is optional and defaults to the WebSocket equivalent of `VITE_API_BASE_URL`. Add the frontend origin to `CORS_ORIGINS` on the backend.

For a quick local demonstration without PostgreSQL, omit `DATABASE_URL` (or set `DATABASE_URL=sqlite:///./fraudlink.db`), then run the migration and seed commands normally.

## Team 4 frontend demonstration accounts

All identities and email addresses below are simulated. The frontend password is `FraudLinkDemo2026!` and the simulated MFA code is `123456`.

| Account | Team member | Initial role | Institution |
| --- | --- | --- | --- |
| `malcolm.okabo@bou.demo.ug` | Malcolm Mark Okabo | BoU Administrator; BoU Oversight Officer | Bank of Uganda |
| `daniella.mukisa@mtn.demo.ug` | Daniella Mukisa | Fraud Analyst | MTN Mobile Money Uganda Limited |
| `esther.nampiina@mtn.demo.ug` | Esther Nampiina | Institution Administrator | MTN Mobile Money Uganda Limited |
| `kevin.mugabi@mtn.demo.ug` | Kevin Mugabi | Fraud Supervisor | MTN Mobile Money Uganda Limited |
| `gideon.maku@mtn.demo.ug` | Gideon Maku | Compliance Auditor | MTN Mobile Money Uganda Limited |

The frontend stores role assignments and demonstration workflow data in one versioned localStorage repository. Reset it from **Settings → Reset Demo Data**. The FastAPI seed retains its legacy API-only accounts for backend integration tests.

## Deterministic demonstration

1. Log in as Bank of Uganda and call `POST /api/v1/simulator/reset` if a clean run is needed.
2. Log in as the MTN analyst and start the stream with `POST /api/v1/simulator/start`.
3. Submit `0772315500` from **Submit Intelligence**, using the confirmed/block decision workflow.
4. The API standardises it to `+256772315500` and generates a deterministic `MSISDN:v1:…` HMAC reference.
5. Background correlation finds five synthetic transfers worth UGX 2,800,000 to an Airtel protected wallet plus rapid cash-out activity.
6. The rules emit `LINKED_TO_CONFIRMED_FRAUD`, `RAPID_TRANSFER_PATTERN`, `RAPID_CASHOUT`, and `HIGH_VALUE_TRANSACTION`, capped at risk score 100/CRITICAL.
7. Only Airtel and BoU oversight receive the alert event. Airtel can update its review status; the change is audited and broadcast to BoU.

Event order: `INCIDENT_CREATED` → `CORRELATION_STARTED` → `RELATIONSHIP_FOUND` → `ALERT_CREATED` → `ALERT_UPDATED`. Transaction and simulator events include `TRANSACTION_RECEIVED`, `TRANSACTION_FLAGGED`, and `SIMULATOR_STATUS_CHANGED`. The browser reconnects its WebSocket with exponential backoff and displays `LIVE`, `RECONNECTING`, or `OFFLINE`.

## API surface

All REST endpoints use `/api/v1`: authentication (`auth/login`, `auth/me`), dashboards, institutions, incidents and relationships, transactions, alerts and status actions, fraud networks, audit events, indicator catalogue, and simulator start/stop/reset/status. The authenticated event socket is `/ws/events?token=<JWT>`.

Authorization is enforced in the backend. Institution users receive only their institution’s alerts, related transactions and permitted audit records; `BOU_OVERSIGHT` can view ecosystem records.

## Validation

```bash
source .venv/bin/activate
pytest -q
npm run typecheck
npm run build
```

Tests cover canonicalisation, deterministic and type-separated protected references, scoring, authentication, seed counts, institution isolation, the exact MTN-to-Airtel scenario, alert decisions/auditing, BoU oversight, and simulator reset authorization.

## MVP limitations

- The transaction stream and institutions are synthetic and intentionally deterministic where useful for judging.
- Canonical identifiers are retained only to make the demo result visible. A production deployment needs envelope encryption/KMS, retention enforcement, rotation and formal privacy review.
- BackgroundTasks is suitable for the short hackathon correlation step but not durable job execution across process crashes.
- JWT revocation, MFA, production TLS termination, secrets management, monitoring and database backups remain deployment responsibilities.
- The existing interface still includes secondary showcase pages whose administrative actions are presentation-only; the authenticated incident, alert, audit, transaction and oversight data path is the implemented MVP core.
