import gzip
import re

backup_path = "/Users/josephpj/Downloads/20260426_213455-crm_piriyathu_com-database.sql.gz"

with gzip.open(backup_path, "rt") as f:
    for line in f:
        if line.startswith("INSERT INTO `tabExpense`"):
            # Split by ),( but be careful with strings
            records = re.findall(r"\((.*?)\)(?:,|$)", line)
            for rec in records:
                cols = re.findall(r"'(?:''|[^'])*'|[^,]+", rec)
                parsed_cols = [c.strip().strip("'").replace("''", "'") if c.strip().startswith("'") else c.strip() for c in cols]
                if len(parsed_cols) > 12:
                    deal = parsed_cols[12]
                    if deal != 'NULL':
                        print(f"Found linked expense: {parsed_cols[7]} -> {deal}")

