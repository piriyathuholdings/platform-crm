#!/usr/bin/env python3
"""Configure local-only Coolify database backup schedules on the host."""

from __future__ import annotations

import random
import string
import subprocess
import sys


def run_psql(sql: str) -> None:
    proc = subprocess.run(
        ["docker", "exec", "coolify-db", "psql", "-U", "coolify", "-d", "coolify", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(proc.returncode)


def gen_uuid() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(25))


def main() -> None:
    print("==> Updating Coolify self-backup")
    run_psql(
        """
        UPDATE scheduled_database_backups
        SET enabled = true,
            save_s3 = false,
            disable_local_backup = false,
            frequency = '0 3 * * *',
            database_backup_retention_amount_locally = 14,
            database_backup_retention_days_locally = 0,
            updated_at = NOW()
        WHERE database_type = 'App\\Models\\StandalonePostgresql' AND database_id = 0;
        """
    )

    print("==> Removing previous auto-local-backup schedules")
    run_psql("DELETE FROM scheduled_database_backups WHERE description LIKE 'auto-local-backup:%';")

    schedules = [
        ("auto-local-backup:computek-postgres", 2, "35 3 * * *", 14, "computek"),
        ("auto-local-backup:dineswipe-mysql", 4, "40 3 * * *", 14, "dineswipe"),
        # Frappe Avosys mariadb lacks MARIADB_DATABASE in container env; use host cron instead.
        # ("auto-local-backup:frappe-avosys-mariadb", 10, "45 3 * * *", 14, "_433701e0a042a19f"),
        ("auto-local-backup:stitchingmate-postgres", 6, "50 3 * * *", 7, "stitchingmate"),
        ("auto-local-backup:sanju-postgres", 1, "55 3 * * *", 7, "sanjuchettan"),
    ]

    print("==> Creating ServiceDatabase backup schedules")
    for desc, db_id, cron, retention, db_name in schedules:
        uuid = gen_uuid()
        db_value = f"'{db_name}'" if db_name else "NULL"
        run_psql(
            f"""
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
              '{uuid}',
              '{desc}',
              true,
              false,
              '{cron}',
              {retention},
              0,
              0,
              'App\\Models\\ServiceDatabase',
              {db_id},
              0,
              {db_value},
              false,
              3600,
              false,
              0,
              0,
              0,
              NOW(),
              NOW()
            );
            """
        )
        print(f"  added {desc}")

    print("==> Current schedules")
    run_psql(
        "SELECT id, description, frequency, database_type, database_id, database_backup_retention_amount_locally FROM scheduled_database_backups ORDER BY id;"
    )


if __name__ == "__main__":
    main()
