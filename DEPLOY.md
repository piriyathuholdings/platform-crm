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

## Backup and restore (production)

Local-only backups are configured on `server.computemate.com` under `/data/coolify/backups/`.

### Platform CRM (this stack)

Coolify v4 on this server does not register Docker Compose `postgres` services as ServiceDatabase resources, so Platform CRM uses a **host cron backup** instead of the Coolify Backups tab:

| Item | Value |
|---|---|
| Script | `/opt/coolify-backups/backup-platform-crm-postgres.sh` |
| Schedule | Daily 03:30 (`/etc/cron.d/coolify-platform-crm-backup`) |
| Retention | 14 dumps |
| Output | `/data/coolify/backups/databases/root-team-0/platform-crm-postgres/crm-*.dump` |

Manual backup:

```bash
sudo /opt/coolify-backups/backup-platform-crm-postgres.sh
```

Restore into the running postgres container (replace dump filename):

```bash
CONTAINER=$(docker ps --filter 'name=postgres-d1wpjrm' --format '{{.Names}}' | head -1)
docker exec -i "$CONTAINER" pg_restore -U crm -d crm --clean --if-exists < /path/to/crm-TIMESTAMP.dump
```

### Other running projects on the same server

| Project | Method | Schedule | Retention |
|---|---|---|---|
| Coolify itself | Coolify scheduled backup | 03:00 daily | 14 |
| CompuTEK | Coolify ServiceDatabase backup | 03:35 daily | 14 |
| DineSwipe app | Coolify ServiceDatabase backup | 03:40 daily | 14 |
| Frappe Avosys | Host cron (`/opt/coolify-backups/backup-frappe-avosys-mariadb.sh`) | 03:45 daily | 14 |
| Stitching Mate | Coolify ServiceDatabase backup | 03:50 daily | 7 |
| Sanju Samson | Coolify ServiceDatabase backup | 03:55 daily | 7 |

Setup scripts live in [`scripts/`](scripts/):

- `configure-coolify-backup-schedules.py` — creates Coolify `scheduled_database_backups` rows
- `setup-coolify-local-backups.sh` — installs Platform CRM host backup + cron

Re-run manual Coolify backups after schedule changes:

```bash
docker exec coolify php artisan schedule:run-manual --type=backups --max=20
```

**Not covered:** host-level Frappe MariaDB for `crm.piriyathu.com` (outside Coolify), Redis caches, stopped stacks.
