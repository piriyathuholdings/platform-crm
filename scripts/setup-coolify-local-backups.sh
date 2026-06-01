#!/usr/bin/env bash
# Configure local-only database backups on Coolify (server.computemate.com).
# Run on the Coolify host with sudo where noted.

set -euo pipefail

BACKUP_SCRIPT_DIR="/opt/coolify-backups"
PLATFORM_CRM_BACKUP_SCRIPT="${BACKUP_SCRIPT_DIR}/backup-platform-crm-postgres.sh"
CRON_FILE="/etc/cron.d/coolify-platform-crm-backup"

gen_uuid() {
  tr -dc 'a-z0-9' </dev/urandom | head -c 25
}

echo "==> Ensuring backup directories exist"
sudo mkdir -p /data/coolify/backups/databases
sudo mkdir -p "${BACKUP_SCRIPT_DIR}"

echo "==> Configuring Coolify self-backup and ServiceDatabase schedules"
docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 <<'SQL'
-- Coolify internal postgres (coolify-db)
UPDATE scheduled_database_backups
SET enabled = true,
    save_s3 = false,
    disable_local_backup = false,
    frequency = '0 3 * * *',
    database_backup_retention_amount_locally = 14,
    database_backup_retention_days_locally = 0,
    updated_at = NOW()
WHERE database_type = 'App\Models\StandalonePostgresql' AND database_id = 0;

-- Remove any prior service-database schedules we may have created
DELETE FROM scheduled_database_backups
WHERE description LIKE 'auto-local-backup:%';
SQL

insert_service_backup() {
  local desc="$1"
  local db_id="$2"
  local cron="$3"
  local retention="$4"
  local db_names="${5:-}"
  local uuid
  uuid="$(gen_uuid)"

  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 <<SQL
INSERT INTO scheduled_database_backups (
  uuid, description, enabled, save_s3, frequency,
  database_backup_retention_amount_locally,
  database_backup_retention_days_locally,
  database_backup_retention_max_storage_locally,
  database_type, database_id, team_id,
  databases_to_backup, dump_all, timeout, disable_local_backup,
  database_backup_retention_amount_s3, database_backup_retention_days_s3,
  database_backup_retention_max_storage_s3,
  created_at, updated_at
) VALUES (
  '${uuid}',
  '${desc}',
  true,
  false,
  '${cron}',
  ${retention},
  0,
  0,
  'App\\Models\\ServiceDatabase',
  ${db_id},
  0,
  $(if [ -n "${db_names}" ]; then echo "'${db_names}'"; else echo "NULL"; fi),
  false,
  3600,
  false,
  0,
  0,
  0,
  NOW(),
  NOW()
);
SQL
}

# ServiceDatabase ids from Coolify DB
insert_service_backup "auto-local-backup:computek-postgres" 2 "35 3 * * *" 14 "computek"
insert_service_backup "auto-local-backup:dineswipe-mysql" 4 "40 3 * * *" 14 "dineswipe"
insert_service_backup "auto-local-backup:frappe-avosys-mariadb" 10 "45 3 * * *" 14 "_433701e0a042a19f"
insert_service_backup "auto-local-backup:stitchingmate-postgres" 6 "50 3 * * *" 7 "stitchingmate"
insert_service_backup "auto-local-backup:sanju-postgres" 1 "55 3 * * *" 7 "sanjuchettan"

echo "==> Installing Platform CRM postgres backup script (compose DB not registered in Coolify)"
sudo tee "${PLATFORM_CRM_BACKUP_SCRIPT}" >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/data/coolify/backups/databases/root-team-0/platform-crm-postgres"
RETENTION=14
CONTAINER="$(docker ps --filter 'name=postgres-d1wpjrm' --format '{{.Names}}' | head -1)"

if [ -z "${CONTAINER}" ]; then
  echo "platform-crm postgres container not found" >&2
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_ROOT}/crm-${TS}.dump"

docker exec "${CONTAINER}" pg_dump -U crm -Fc --no-acl --no-owner crm > "${OUT}"
chmod 600 "${OUT}"

mapfile -t OLD_FILES < <(ls -1t "${BACKUP_ROOT}"/crm-*.dump 2>/dev/null || true)
if [ "${#OLD_FILES[@]}" -gt "${RETENTION}" ]; then
  for f in "${OLD_FILES[@]:${RETENTION}}"; do
    rm -f "${f}"
  done
fi

echo "Backup written: ${OUT}"
SCRIPT

sudo chmod 750 "${PLATFORM_CRM_BACKUP_SCRIPT}"

echo "==> Installing Platform CRM cron job (daily 03:30)"
sudo tee "${CRON_FILE}" >/dev/null <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
30 3 * * * root ${PLATFORM_CRM_BACKUP_SCRIPT} >> /var/log/coolify-platform-crm-backup.log 2>&1
CRON

echo "==> Triggering manual backups via Coolify"
docker exec coolify php artisan schedule:run-manual --type=backups --max=20 --no-interaction || true
"${PLATFORM_CRM_BACKUP_SCRIPT}" || true

echo "==> Backup setup complete"
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT id, description, frequency, database_type, database_id, database_backup_retention_amount_locally FROM scheduled_database_backups ORDER BY id;"

echo "==> Local backup files"
sudo find /data/coolify/backups -type f 2>/dev/null | head -30
