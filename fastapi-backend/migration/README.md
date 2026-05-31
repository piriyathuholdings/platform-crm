# Frappe to FastAPI Data Migration

This directory contains scripts to migrate data from Frappe CRM to the FastAPI backend.

## CSV export import (local restore)

If you downloaded a server export bundle from the CRM UI (files like `piriyathu-crm-manifest-YYYYMMDD.json` and `piriyathu-crm-*-YYYYMMDD.csv` in Downloads), restore it into local SQLite with:

```bash
cd fastapi-backend
source venv/bin/activate
python migration/import_from_csv_export.py --data-dir ~/Downloads --reset-db
```

This wipes `dev.db`, imports all doctypes in FK order, preserves public IDs (`DEAL-00004`, `PROD-00213`, etc.), seeds login users, and recalculates deal financials from expenses/payments.

## Prerequisites

1. **Frappe Database Access**: Ensure you have read access to the Frappe database
2. **FastAPI Backend**: The FastAPI application should be set up and running
3. **Database Backup**: Always backup your databases before migration

## Setup

1. **Install Dependencies**:
   ```bash
   cd fastapi-backend
   source venv/bin/activate
   pip install -r migration/requirements.txt
   ```

2. **Configure Database Connection**:
   Edit `migration/migration.env` and update the Frappe database connection details:
   ```env
   FRAPPE_DB_HOST=your_frappe_host
   FRAPPE_DB_USER=your_db_user
   FRAPPE_DB_PASSWORD=your_db_password
   FRAPPE_DB_NAME=your_frappe_database
   ```

3. **Update FastAPI Configuration**:
   Ensure your FastAPI `.env` file has the correct database URL for the target database.

## Migration Process

### Dry Run (Recommended First Step)

Run a dry run to see what would be migrated without actually migrating data:

```bash
python migration/migrate_data.py --dry-run --limit 10
```

This will show the first 10 records from each doctype that would be migrated.

### Full Migration

To migrate all data:

```bash
python migration/migrate_data.py
```

### Selective Migration

To migrate only specific doctypes:

```bash
# Migrate only Products
python migration/migrate_data.py --doctype "Product"

# Migrate only Contacts with limit
python migration/migrate_data.py --doctype "Contact" --limit 100
```

## Migration Order

Data is migrated in the following order to respect foreign key relationships:

1. Product
2. Organization
3. Contact
4. Lead
5. Deal
6. Task
7. Note
8. Activity
9. Expense
10. Client Payment

## Data Transformation

The migration script handles:

- **Naming Series**: Converts Frappe naming series to FastAPI format
- **Custom Fields**: Migrates custom field data to appropriate model fields
- **Relationships**: Resolves foreign key relationships between doctypes
- **Data Types**: Converts Frappe data types to FastAPI/Pydantic types
- **Automations**: Applies business logic rules during migration

## Monitoring and Logging

- All migration activities are logged to `migration.log`
- Progress is shown in the console
- Statistics are displayed at the end of migration

## Error Handling

- Failed records are logged with error details
- Migration continues even if individual records fail
- Use `--dry-run` to identify potential issues before actual migration

## Rollback

If you need to rollback:

1. **Database Level**: Restore from backup
2. **Application Level**: The migration doesn't modify Frappe data, only reads from it

## Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Check Frappe database credentials in `migration.env`
   - Ensure Frappe database is accessible from migration host

2. **Foreign Key Errors**:
   - Ensure migration runs in the correct order
   - Check that referenced records exist

3. **Custom Field Missing**:
   - Verify custom fields are properly defined in Frappe
   - Check migration script handles all custom fields

4. **Memory Issues**:
   - Use `--limit` to process data in smaller batches
   - Monitor system resources during migration

### Getting Help

- Check `migration.log` for detailed error messages
- Run with `--dry-run --limit 1` to test basic connectivity
- Verify all prerequisites are met

## Production Migration

⚠️ **CRITICAL**: Production migration should only be performed during a maintenance window with all stakeholders notified.

### Pre-Migration Checklist

- [ ] Create full backups of both Frappe and FastAPI databases
- [ ] Test migration on production data copy
- [ ] Verify all custom fields are mapped correctly
- [ ] Confirm business logic validation works
- [ ] Notify users of maintenance window
- [ ] Prepare rollback plan

### Production Migration Steps

1. **Dry Run Test**:
   ```bash
   python migration/migrate_production.py --dry-run
   ```

2. **Monitor Setup** (in another terminal):
   ```bash
   python migration/monitor.py --watch --alert-threshold 5
   ```

3. **Execute Production Migration**:
   ```bash
   python migration/migrate_production.py --confirm
   ```

4. **Verify Migration**:
   ```bash
   python migration/monitor.py --summary
   ```

### Monitoring and Control

- **Real-time Monitoring**: Use `monitor.py --watch` to track progress
- **Pause/Resume**: Migration can be stopped and resumed from any doctype
- **Batch Processing**: Large datasets are processed in configurable batches
- **Error Handling**: Failed records are logged but don't stop migration

### Rollback Procedures

If migration fails or issues are discovered:

1. **Complete Rollback** (restore from backup):
   ```bash
   python migration/rollback.py --type complete --backup-file backups/fastapi_backup_20240101.sql
   ```

2. **Partial Rollback** (remove recent data):
   ```bash
   python migration/rollback.py --type partial --since "2024-01-01T00:00:00"
   ```

3. **Selective Rollback** (remove specific data types):
   ```bash
   python migration/rollback.py --type selective --doctypes "Contact,Deal"
   ```

### Post-Migration

After successful migration:

1. **Data Verification**: Spot-check critical records
2. **Application Testing**: Test all features with migrated data
3. **Performance Monitoring**: Check query performance
4. **User Communication**: Notify users of successful migration
5. **Backup Archival**: Archive migration backups per retention policy