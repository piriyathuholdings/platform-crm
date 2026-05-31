# Data import

Restore CRM data from a CSV export bundle (manifest + per-doctype CSV files):

```bash
cd fastapi-backend
source venv/bin/activate
python migration/import_from_csv_export.py --data-dir ~/Downloads --reset-db
```

This resets `dev.db`, imports records in FK order, preserves public IDs (`DEAL-00004`, `PROD-00213`, etc.), seeds login users, and recalculates deal financials from expenses and payments.

## Public IDs

- Backfill legacy rows: `python migration/backfill_public_ids.py`
- Validate naming: `python migration/validate_public_ids.py`

## Dependencies

```bash
pip install -r migration/requirements.txt
```
