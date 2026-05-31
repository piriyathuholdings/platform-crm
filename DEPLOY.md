# Deploy platform-crm on Coolify

## Stack

| Service | Port | Role |
|---|---|---|
| `postgres` | internal | CRM database |
| `api` | 9000 internal | FastAPI backend |
| `web` | 3000 public | Next.js frontend |

## Coolify setup

1. Create a project (e.g. `platform-crm`).
2. Add a **Docker Compose** resource from GitHub:
   - Repository: `piriyathuholdings/platform-crm`
   - Branch: `main`
   - Compose file: `docker-compose.yml`
3. Set environment variables from [`docker-compose.env.example`](docker-compose.env.example).
4. Deploy and confirm:
   - API health: `GET /health` on the api service
   - Web: login page loads
5. Assign domain `crm.piriyathu.com` to the **web** service.

## Production env checklist

- `POSTGRES_PASSWORD` — strong password
- `JWT_SECRET_KEY` — long random secret
- `NEXTJS_ORIGIN=https://crm.piriyathu.com`

## Import existing CRM data

1. Export production data (manifest JSON + per-doctype CSV files).
2. Copy the export bundle into the **api** container.
3. Run:

```bash
python migration/import_from_csv_export.py --data-dir /path/to/export --reset-db
python seed_user.py
```

**Warning:** `--reset-db` wipes the target database. Run only once on a fresh Postgres volume.

## Local compose test

```bash
cp docker-compose.env.example docker-compose.env
# Edit docker-compose.env with real secrets
docker compose --env-file docker-compose.env up --build
```

Open http://localhost:3000
