# FastAPI CRM Backend

This scaffold is a starting point for migrating your CRM backend from Frappe to FastAPI.

## What is included
- FastAPI app layout with routers, services, models, and configuration
- SQLModel-based database layer
- example CRM lead routes
- JWT-compatible auth helpers and environment-based config

## Setup

1. Create and activate a virtual environment:

```bash
cd fastapi-backend
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy and configure environment variables:

```bash
cp .env.example .env
```

4. Seed a local user and start the app:

```bash
python seed_user.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

## Local dev without Frappe

Local development uses only FastAPI and the Next.js frontend. You do not need `frappe-bench`, MariaDB, or Redis running.

1. Configure [`fastapi-backend/.env`](.env) with `DATABASE_URL=sqlite:///./dev.db`.
2. Configure [`piriyathu-crm-next/.env`](../piriyathu-crm-next/.env) with `FRAPPE_BASE_URL=http://localhost:9000` (legacy env name; value is the FastAPI URL).
3. From the repo root, run:

```bash
./scripts/dev-local.sh
```

Or start each service manually:

```bash
# Terminal 1
cd fastapi-backend && source venv/bin/activate && python seed_user.py && uvicorn app.main:app --reload --port 9000

# Terminal 2
cd piriyathu-crm-next && npm run dev
```

Open `http://localhost:3000` and sign in with `joseph.p.j@icloud.com` / `password`.

## Folder structure

- `app/main.py` - application entrypoint
- `app/config.py` - environment and runtime settings
- `app/db.py` - database engine and session setup
- `app/models/crm.py` - SQL model definitions for CRM entities
- `app/schemas/crm.py` - request/response schema definitions
- `app/routers/crm.py` - CRM REST endpoints
- `app/services/crm.py` - business logic and persistence operations
- `app/auth.py` - auth helpers and token creation

## Migration guidance

- Use this scaffold as the new backend service while keeping Frappe running in parallel.
- Migrate Frappe doctypes to SQLModel models one at a time.
- Port Frappe workflows into `app/services` and create matching FastAPI routes.
- Replace frontend calls in `piriyathu-crm-next` to point to the new API.

## Notes

- The API currently uses a simple `Lead` model as an example.
- Use the existing Redis endpoints from Frappe config for background jobs and cache if needed.
- Extend this scaffold as you map more CRM entities.
